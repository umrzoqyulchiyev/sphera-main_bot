import re
import unicodedata

import httpx
from fastapi import APIRouter, HTTPException

from app.core.database import db
from app.core.models import CityOut, GeoSearchResult, EnsureCityRequest
from app.core.ws_manager import manager
from app.core.state import add_valid_city

router = APIRouter(prefix="/cities", tags=["cities"])


def _make_slug(name: str) -> str:
    """Shahar nomidan slug yasaydi (lotin transliteratsiya, unikal)."""
    text = unicodedata.normalize("NFKD", name)
    text = text.encode("ascii", "ignore").decode("ascii").lower()
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text or "city"


@router.get("", response_model=list[CityOut])
async def list_cities():
    rows = await db.fetch(
        """
        SELECT slug, name_ru, name_uz, country_ru, country_uz, lat, lng
        FROM cities
        WHERE is_active = true
        ORDER BY name_ru
        """
    )
    result = []
    for r in rows:
        result.append(
            CityOut(
                slug=r["slug"],
                name_ru=r["name_ru"],
                name_uz=r["name_uz"],
                country_ru=r["country_ru"],
                country_uz=r["country_uz"],
                lat=r["lat"],
                lng=r["lng"],
                listeners_count=manager.listeners_count(r["slug"]),
            )
        )
    return result


@router.get("/map/users")
async def map_users(tone: str | None = None):
    """Xarita uchun: shaharlar bo'yicha aktiv foydalanuvchilar va psixotiplari.

    PDF talabi: xaritada geolokatsiya/aktivlik markerlari + psixotip filtri.
    `tone` berilsa — faqat shu emotional_tone li foydalanuvchilar.
    Shaxsiy maxfiylik: aniq ism emas, faqat shahar bo'yicha agregat + psixotip.
    """
    rows = await db.fetch(
        """
        SELECT c.slug, c.name_ru, c.country_ru, c.lat, c.lng,
               COUNT(DISTINCT u.id) AS users_count,
               COUNT(DISTINCT u.id) FILTER (WHERE u.last_seen > NOW() - INTERVAL '10 minutes') AS active_now
        FROM cities c
        LEFT JOIN users u ON u.city = c.slug
        WHERE c.is_active = true
        GROUP BY c.slug, c.name_ru, c.country_ru, c.lat, c.lng
        ORDER BY c.name_ru
        """
    )

    result = []
    for r in rows:
        # Shahar bo'yicha psixotip taqsimoti
        tone_rows = await db.fetch(
            """
            SELECT p.emotional_tone, COUNT(*) AS cnt
            FROM psychotypes p
            JOIN users u ON u.id = p.user_id
            WHERE u.city = $1
            GROUP BY p.emotional_tone
            """,
            r["slug"],
        )
        tones = {tr["emotional_tone"]: tr["cnt"] for tr in tone_rows if tr["emotional_tone"]}

        # Filtr: tone berilgan bo'lsa va bu shaharda yo'q bo'lsa — o'tkazib yuboramiz
        if tone and tone not in tones:
            continue

        result.append(
            {
                "slug": r["slug"],
                "name_ru": r["name_ru"],
                "country_ru": r["country_ru"],
                "lat": r["lat"],
                "lng": r["lng"],
                "users_count": r["users_count"],
                "active_now": r["active_now"],
                "listeners_count": manager.listeners_count(r["slug"]),
                "tones": tones,
            }
        )
    return result


@router.get("/geo-search", response_model=list[GeoSearchResult])
async def geo_search(q: str):
    """Butun dunyo bo'yicha shahar/davlat qidiruvi (OpenStreetMap Nominatim).

    Avval bazadagi shaharlarni, keyin Nominatim natijalarini qaytaradi.
    """
    q = (q or "").strip()
    if len(q) < 2:
        return []

    results: list[GeoSearchResult] = []
    seen = set()

    # 1. Bazadagi shaharlar (nom yoki davlat bo'yicha)
    db_rows = await db.fetch(
        """
        SELECT slug, name_ru, country_ru, lat, lng
        FROM cities
        WHERE is_active = true
          AND (name_ru ILIKE $1 OR name_uz ILIKE $1 OR country_ru ILIKE $1 OR slug ILIKE $1)
        LIMIT 10
        """,
        f"%{q}%",
    )
    for r in db_rows:
        results.append(
            GeoSearchResult(
                slug=r["slug"],
                name_ru=r["name_ru"],
                country_ru=r["country_ru"],
                lat=r["lat"],
                lng=r["lng"],
            )
        )
        seen.add(r["slug"])

    # 2. Nominatim (butun dunyo)
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://nominatim.openstreetmap.org/search",
                params={
                    "q": q,
                    "format": "json",
                    "addressdetails": 1,
                    "limit": 8,
                    "featuretype": "city",
                    "accept-language": "ru",
                },
                headers={"User-Agent": "Sfera5Radio/1.0"},
                timeout=10,
            )
            if resp.status_code == 200:
                for item in resp.json():
                    addr = item.get("address", {})
                    name = (
                        addr.get("city")
                        or addr.get("town")
                        or addr.get("village")
                        or addr.get("state")
                        or item.get("name")
                        or item.get("display_name", "").split(",")[0]
                    )
                    country = addr.get("country")
                    lat = float(item["lat"])
                    lng = float(item["lon"])
                    slug = _make_slug(name)
                    if not slug or slug == "city":
                        slug = f"geo-{round(lat,3)}-{round(lng,3)}".replace(".", "")
                    if slug in seen:
                        continue
                    seen.add(slug)
                    results.append(
                        GeoSearchResult(
                            slug=slug,
                            name_ru=name,
                            country_ru=country,
                            lat=lat,
                            lng=lng,
                        )
                    )
    except Exception:
        pass

    return results


@router.post("/ensure", response_model=CityOut)
async def ensure_city(payload: EnsureCityRequest):
    """Qidiruvdan tanlangan shaharni bazaga qo'shadi (agar yo'q bo'lsa)."""
    slug = _make_slug(payload.name)
    if not slug or slug == "city":
        slug = f"geo-{round(payload.lat,3)}-{round(payload.lng,3)}".replace(".", "")

    existing = await db.fetchrow("SELECT * FROM cities WHERE slug = $1", slug)
    if existing is None:
        existing = await db.fetchrow(
            """
            INSERT INTO cities (name_ru, name_uz, country_ru, country_uz, slug, lat, lng)
            VALUES ($1, $1, $2, $2, $3, $4, $5)
            ON CONFLICT (slug) DO UPDATE SET name_ru = EXCLUDED.name_ru
            RETURNING *
            """,
            payload.name,
            payload.country or "",
            slug,
            payload.lat,
            payload.lng,
        )
    add_valid_city(slug)

    return CityOut(
        slug=existing["slug"],
        name_ru=existing["name_ru"],
        name_uz=existing["name_uz"],
        country_ru=existing["country_ru"],
        country_uz=existing["country_uz"],
        lat=existing["lat"],
        lng=existing["lng"],
        listeners_count=manager.listeners_count(existing["slug"]),
    )
