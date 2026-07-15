"""Casting router — ведущий отбори.

Foydalanuvchi ariza + ovozli audishen topshiradi (POST /casting/apply).
Admin ko'rib chiqadi (GET /casting/admin/list) va tasdiqlasa foydalanuvchi
'doverenniy' bo'ladi — efirga chiqish huquqi (POST /casting/admin/{id}/approve).
"""

import logging
import os
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse

from app.core.config import settings
from app.core.database import db
from app.core.dependencies import decode_token, get_current_user, require_admin
from app.core.models import (
    CastingApplicationOut,
    CastingDecisionRequest,
    CastingStatusOut,
    OkResponse,
)

log = logging.getLogger("casting")

router = APIRouter(prefix="/casting", tags=["casting"])

_ALLOWED_AUDIO = {".webm", ".ogg", ".mp3", ".m4a", ".wav", ".oga"}


async def _convert_to_mp3(src_path: str, uid: str) -> str:
    """Audio faylni MP3 ga konvert qiladi. Xato bo'lsa asl fayl nomi qaytariladi."""
    import asyncio

    mp3_fname = f"casting_{uid}.mp3"
    mp3_fpath = os.path.join(settings.upload_dir, mp3_fname)
    try:
        proc = await asyncio.create_subprocess_exec(
            "ffmpeg",
            "-y",
            "-i",
            src_path,
            "-vn",
            "-acodec",
            "libmp3lame",
            "-b:a",
            "96k",
            mp3_fpath,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
        )
        await proc.wait()
        if proc.returncode == 0 and os.path.isfile(mp3_fpath) and os.path.getsize(mp3_fpath) > 0:
            try:
                os.remove(src_path)
            except OSError:
                pass
            return mp3_fname
        log.warning("ffmpeg conversion failed (rc=%s), keeping original", proc.returncode)
    except FileNotFoundError:
        log.warning("ffmpeg not found, keeping original audio format")
    except Exception as exc:  # noqa: BLE001
        log.warning("ffmpeg conversion error: %s, keeping original", exc)
    return os.path.basename(src_path)


@router.get("/status", response_model=CastingStatusOut)
async def my_casting_status(user: dict = Depends(get_current_user)):
    """Joriy foydalanuvchining oxirgi arizasi holati."""
    if user["role"] in ("doverenniy", "admin"):
        return CastingStatusOut(already_doverenniy=True)

    row = await db.fetchrow(
        """
        SELECT status, admin_note, created_at
        FROM casting_applications
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 1
        """,
        user["id"],
    )
    if row is None:
        return CastingStatusOut(applied=False)
    return CastingStatusOut(
        applied=True,
        status=row["status"],
        admin_note=row["admin_note"] or "",
        created_at=row["created_at"],
    )


@router.post("/apply", response_model=OkResponse)
async def apply_casting(
    audio_file: UploadFile = File(...),
    note: str = Form(default=""),
    user: dict = Depends(get_current_user),
):
    """Kasting arizasini topshiradi (ovozli audishen + ixtiyoriy matn)."""
    if user["role"] in ("doverenniy", "admin"):
        raise HTTPException(status_code=400, detail="Siz allaqachon doverenniy")

    existing = await db.fetchrow(
        "SELECT id FROM casting_applications WHERE user_id = $1 AND status = 'pending'",
        user["id"],
    )
    if existing is not None:
        raise HTTPException(status_code=400, detail="Arizangiz allaqachon ko'rib chiqilmoqda")

    ext = os.path.splitext(audio_file.filename or "")[1].lower() or ".webm"
    if ext not in _ALLOWED_AUDIO:
        raise HTTPException(status_code=400, detail="Unsupported audio format")

    os.makedirs(settings.upload_dir, exist_ok=True)
    content = await audio_file.read()
    if len(content) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large")
    if len(content) < 800:
        raise HTTPException(status_code=400, detail="Recording too short")

    uid = uuid.uuid4().hex
    raw_fname = f"casting_{uid}{ext}"
    raw_fpath = os.path.join(settings.upload_dir, raw_fname)
    with open(raw_fpath, "wb") as f:
        f.write(content)

    fname = await _convert_to_mp3(raw_fpath, uid)

    await db.execute(
        """
        INSERT INTO casting_applications (user_id, audio_path, note)
        VALUES ($1, $2, $3)
        """,
        user["id"],
        fname,
        note.strip()[:500],
    )
    log.info("Casting application submitted: user=%d file=%s", user["id"], fname)
    return OkResponse(detail={"status": "pending"})


@router.get("/audio/{filename}")
async def get_casting_audio(filename: str, token: str = Query(...)):
    """[admin] Audishen audio faylini qaytaradi.

    Authorization header o'rniga query-param token qabul qiladi — <audio>
    tegi maxsus header yubora olmaydi (WebSocket auth'dagi kabi yechim).
    """
    try:
        telegram_id = decode_token(token)
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc

    row = await db.fetchrow("SELECT role FROM users WHERE telegram_id = $1", telegram_id)
    if row is None or row["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    safe = os.path.basename(filename)
    fpath = os.path.join(settings.upload_dir, safe)
    if not os.path.isfile(fpath):
        raise HTTPException(status_code=404, detail="Audio not found")
    return FileResponse(fpath, media_type="audio/mpeg")


@router.get("/admin/list", response_model=list[CastingApplicationOut])
async def list_casting_applications(
    status: str = "pending",
    admin: dict = Depends(require_admin),
):
    """[admin] Kasting arizalari ro'yxati."""
    if status not in ("pending", "approved", "rejected"):
        raise HTTPException(status_code=400, detail="Invalid status")

    rows = await db.fetch(
        """
        SELECT c.id, c.user_id, u.username, u.display_name, c.audio_path, c.note,
               c.status, c.admin_note, c.created_at, c.decided_at
        FROM casting_applications c
        JOIN users u ON u.id = c.user_id
        WHERE c.status = $1
        ORDER BY c.created_at DESC
        LIMIT 100
        """,
        status,
    )
    return [
        CastingApplicationOut(
            id=r["id"],
            user_id=r["user_id"],
            username=r["username"],
            display_name=r["display_name"],
            audio_url=f"/casting/audio/{r['audio_path']}",
            note=r["note"] or "",
            status=r["status"],
            admin_note=r["admin_note"] or "",
            created_at=r["created_at"],
            decided_at=r["decided_at"],
        )
        for r in rows
    ]


@router.post("/admin/{application_id}/approve", response_model=OkResponse)
async def approve_casting(
    application_id: int,
    payload: CastingDecisionRequest,
    admin: dict = Depends(require_admin),
):
    """[admin] Arizani tasdiqlaydi — foydalanuvchi 'doverenniy' bo'ladi."""
    row = await db.fetchrow(
        "SELECT user_id, status FROM casting_applications WHERE id = $1", application_id
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Application not found")
    if row["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Already {row['status']}")

    await db.execute(
        """
        UPDATE casting_applications
        SET status = 'approved', admin_note = $1, decided_at = NOW()
        WHERE id = $2
        """,
        payload.admin_note.strip()[:500],
        application_id,
    )
    await db.execute(
        "UPDATE users SET level = 3, role = 'doverenniy' WHERE id = $1", row["user_id"]
    )
    log.info(
        "Casting approved: application=%d user=%d by admin=%d",
        application_id,
        row["user_id"],
        admin["id"],
    )
    return OkResponse(detail={"user_id": row["user_id"], "status": "approved"})


@router.post("/admin/{application_id}/reject", response_model=OkResponse)
async def reject_casting(
    application_id: int,
    payload: CastingDecisionRequest,
    admin: dict = Depends(require_admin),
):
    """[admin] Arizani rad etadi."""
    result = await db.execute(
        """
        UPDATE casting_applications
        SET status = 'rejected', admin_note = $1, decided_at = NOW()
        WHERE id = $2 AND status = 'pending'
        """,
        payload.admin_note.strip()[:500],
        application_id,
    )
    if result.endswith("0"):
        raise HTTPException(status_code=404, detail="Application not found or already decided")
    log.info("Casting rejected: application=%d by admin=%d", application_id, admin["id"])
    return OkResponse(detail={"status": "rejected"})
