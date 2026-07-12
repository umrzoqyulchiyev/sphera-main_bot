"""Musiqa ovoz berish — INTRA GROUP.

Boshliq g'oyasi: foydalanuvchilar "qaysi musiqa eshitmoqchisiz?" deb
nomzod taklif qiladi va ovoz beradi → AI/admin ko'pchilik tanlovini
biladi va efirda shu musiqa qo'yiladi.

Endpointlar:
  GET  /music/nominations/{topic_id}  — mavzu uchun nomzodlar ro'yxati (ovoz soni bilan)
  POST /music/nominations             — nomzod qo'shish (0.001 point)
  POST /music/vote/{nomination_id}    — ovoz berish (0.001 point)
  GET  /music/winner/{topic_id}       — g'olib nomzod (admin + tinglovchi)
  GET  /music/current                 — joriy mavzu uchun nomzodlar (quick endpoint)
"""

import logging
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.database import db
from app.core.dependencies import get_current_user, require_admin
from app.core.models import OkResponse
from app.services import points as points_service

log = logging.getLogger("music")

router = APIRouter(prefix="/music", tags=["music"])

COST_NOMINATE = Decimal("0.001")   # nomzod qo'shish
COST_VOTE     = Decimal("0.001")   # ovoz berish


class NominationRequest(BaseModel):
    topic_id: int
    title: str          # "Qo'shiq nomi"
    artist: str = ""    # "Artist nomi" (ixtiyoriy)


# ──────────────────────────────────────────────────────────
# Nomzodlar ro'yxati
# ──────────────────────────────────────────────────────────

@router.get("/nominations/{topic_id}")
async def get_nominations(topic_id: int, user: dict = Depends(get_current_user)):
    """Mavzu bo'yicha musiqa nomzodlari (ovoz soni bo'yicha saralangan)."""
    rows = await db.fetch(
        """
        SELECT mn.id, mn.title, mn.artist, mn.vote_count, mn.created_at,
               u.username, u.display_name,
               EXISTS(
                   SELECT 1 FROM music_votes mv
                   WHERE mv.nomination_id = mn.id AND mv.user_id = $2
               ) AS user_voted
        FROM music_nominations mn
        LEFT JOIN users u ON u.id = mn.user_id
        WHERE mn.topic_id = $1
        ORDER BY mn.vote_count DESC, mn.created_at ASC
        LIMIT 50
        """,
        topic_id, user["id"],
    )
    return [dict(r) for r in rows]


@router.get("/current")
async def get_current_nominations(user: dict = Depends(get_current_user)):
    """Joriy faol mavzu uchun musiqa nomzodlari."""
    topic = await db.fetchrow(
        "SELECT id, title FROM topics WHERE status = 'active' ORDER BY created_at DESC LIMIT 1"
    )
    if not topic:
        return {"topic": None, "nominations": []}

    rows = await db.fetch(
        """
        SELECT mn.id, mn.title, mn.artist, mn.vote_count, mn.created_at,
               u.username, u.display_name,
               EXISTS(
                   SELECT 1 FROM music_votes mv
                   WHERE mv.nomination_id = mn.id AND mv.user_id = $2
               ) AS user_voted
        FROM music_nominations mn
        LEFT JOIN users u ON u.id = mn.user_id
        WHERE mn.topic_id = $1
        ORDER BY mn.vote_count DESC, mn.created_at ASC
        LIMIT 20
        """,
        topic["id"], user["id"],
    )
    return {
        "topic": dict(topic),
        "nominations": [dict(r) for r in rows],
    }


# ──────────────────────────────────────────────────────────
# Nomzod qo'shish
# ──────────────────────────────────────────────────────────

@router.post("/nominations", response_model=OkResponse)
async def add_nomination(
    payload: NominationRequest,
    user: dict = Depends(get_current_user),
):
    """Musiqa nomzod qo'shish — 0.001 point sarflanadi."""
    title = payload.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Title required")

    # Mavzu faolmi?
    topic = await db.fetchrow(
        "SELECT id, status FROM topics WHERE id = $1", payload.topic_id
    )
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    if topic["status"] != "active":
        raise HTTPException(status_code=400, detail="Topic is not active")

    # Bir foydalanuvchi bitta mavzuga 3 tadan ko'p nomzod qo'sha olmaydi
    existing = await db.fetchval(
        "SELECT COUNT(*) FROM music_nominations WHERE topic_id=$1 AND user_id=$2",
        payload.topic_id, user["id"],
    )
    if existing >= 3:
        raise HTTPException(status_code=400, detail="Maximum 3 nominations per topic")

    # Point sarflash
    spent = await points_service.spend(user["id"], "music_nominate", COST_NOMINATE)
    if not spent["ok"]:
        raise HTTPException(
            status_code=402,
            detail={"error": "insufficient_points", "points": str(spent["points"])},
        )

    row = await db.fetchrow(
        """
        INSERT INTO music_nominations (topic_id, user_id, title, artist)
        VALUES ($1, $2, $3, $4)
        RETURNING id, title, artist, vote_count
        """,
        payload.topic_id, user["id"], title, payload.artist.strip(),
    )
    log.info("Nomination added: user=%d topic=%d title=%s", user["id"], payload.topic_id, title)
    return OkResponse(detail={
        "nomination_id": row["id"],
        "title": row["title"],
        "points": str(spent["points"]),
    })


# ──────────────────────────────────────────────────────────
# Ovoz berish
# ──────────────────────────────────────────────────────────

@router.post("/vote/{nomination_id}", response_model=OkResponse)
async def vote_nomination(
    nomination_id: int,
    user: dict = Depends(get_current_user),
):
    """Musiqa nomzodiga ovoz berish — 0.001 point, bitta mavzuda bitta ovoz."""
    nom = await db.fetchrow(
        "SELECT mn.id, mn.topic_id, t.status FROM music_nominations mn JOIN topics t ON t.id=mn.topic_id WHERE mn.id=$1",
        nomination_id,
    )
    if not nom:
        raise HTTPException(status_code=404, detail="Nomination not found")
    if nom["status"] != "active":
        raise HTTPException(status_code=400, detail="Topic is closed for voting")

    # Bir mavzuda bitta ovoz tekshiruvi
    already = await db.fetchval(
        "SELECT id FROM music_votes WHERE user_id=$1 AND topic_id=$2",
        user["id"], nom["topic_id"],
    )
    if already:
        raise HTTPException(status_code=409, detail="Already voted for this topic")

    # Point sarflash
    spent = await points_service.spend(user["id"], "music_vote", COST_VOTE)
    if not spent["ok"]:
        raise HTTPException(
            status_code=402,
            detail={"error": "insufficient_points", "points": str(spent["points"])},
        )

    # Ovozni yozish + vote_count oshirish (atomic)
    await db.execute(
        "INSERT INTO music_votes (nomination_id, user_id, topic_id) VALUES ($1,$2,$3)",
        nomination_id, user["id"], nom["topic_id"],
    )
    await db.execute(
        "UPDATE music_nominations SET vote_count = vote_count + 1 WHERE id = $1",
        nomination_id,
    )

    log.info("Vote: user=%d nomination=%d", user["id"], nomination_id)
    return OkResponse(detail={"nomination_id": nomination_id, "points": str(spent["points"])})


# ──────────────────────────────────────────────────────────
# G'olib (admin va tinglovchi uchun)
# ──────────────────────────────────────────────────────────

@router.get("/winner/{topic_id}")
async def get_winner(topic_id: int, user: dict = Depends(get_current_user)):
    """Mavzu bo'yicha g'olib musiqa (eng ko'p ovoz olgan)."""
    row = await db.fetchrow(
        """
        SELECT mn.id, mn.title, mn.artist, mn.vote_count,
               u.username, u.display_name
        FROM music_nominations mn
        LEFT JOIN users u ON u.id = mn.user_id
        WHERE mn.topic_id = $1
        ORDER BY mn.vote_count DESC
        LIMIT 1
        """,
        topic_id,
    )
    if not row:
        return {"winner": None}
    return {"winner": dict(row)}


# ──────────────────────────────────────────────────────────
# Moderatsiya (faqat admin)
# ──────────────────────────────────────────────────────────

@router.delete("/nominations/{nomination_id}", response_model=OkResponse)
async def delete_nomination(nomination_id: int, admin: dict = Depends(require_admin)):
    """[admin] Nomzodni o'chirish (spam/nomaqbul nomzodlarni tozalash)."""
    row = await db.fetchrow("SELECT id FROM music_nominations WHERE id = $1", nomination_id)
    if not row:
        raise HTTPException(status_code=404, detail="Nomination not found")
    await db.execute("DELETE FROM music_nominations WHERE id = $1", nomination_id)
    log.info("Nomination deleted by admin=%d: nomination=%d", admin["id"], nomination_id)
    return OkResponse(detail={"deleted": nomination_id})
