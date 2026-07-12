"""Pydantic models — INTRA GROUP v3.0.

Yangi TZ: til tanlash, kasr points, level tizimi, transfer/request.
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional, Any

from pydantic import BaseModel, Field


# ============ Auth ============
class TelegramAuthRequest(BaseModel):
    telegram_id: int
    username: Optional[str] = None
    full_name: Optional[str] = None


class AuthResponse(BaseModel):
    token: str
    is_new_user: bool = False
    language: Optional[str] = None  # tanlangan til (None = hali tanlamagan)
    level: int = 1
    points: Decimal = Decimal("0.0000")


class SelectLanguageRequest(BaseModel):
    language: str  # ru | en | lt


# ============ Users / Profile ============
class UserProfileOut(BaseModel):
    id: int
    telegram_id: int
    username: Optional[str] = None
    display_name: Optional[str] = None
    language: str = "ru"
    level: int = 1
    level_name: str = "Слушатель"
    points: Decimal = Decimal("0.0000")
    role: str = "listener"
    # TZ §4: Psixologik profil (AI analitika)
    focus_of_attention: Optional[str] = None   # vnutrenniy | vneshniy
    emotional_tone: Optional[str] = None        # optimist | melanxolik | ratsional
    key_topic: Optional[str] = None


class UpdateProfileRequest(BaseModel):
    display_name: Optional[str] = None
    username: Optional[str] = None


# ============ Points ============
class PointsBalanceOut(BaseModel):
    points: Decimal
    level: int
    level_name: str


class PointsTransferRequest(BaseModel):
    to_user_id: int  # aslida telegram_id (profilda ko'rsatiladigan ID)
    amount: Decimal = Field(gt=0)


class PointsRequestCreate(BaseModel):
    """Boshqa foydalanuvchidan point so'rash."""
    from_user_id: int  # kimdan so'ralyapti — aslida telegram_id (profilda ko'rsatiladigan ID)
    amount: Decimal = Field(gt=0)
    message: str = ""


class PointsRequestOut(BaseModel):
    id: int
    from_user_id: int
    from_display_name: Optional[str] = None
    to_user_id: int
    amount: Decimal
    status: str
    message: str
    created_at: datetime


class PointsRequestDecision(BaseModel):
    approve: bool  # True = berish, False = rad etish


class PointPackageOut(BaseModel):
    id: int
    points_amount: Decimal
    price_eur: Decimal
    label: str


class PurchaseRequest(BaseModel):
    package_id: int


class PointsTransactionOut(BaseModel):
    id: int
    amount: Decimal
    event_type: str
    description: str
    created_at: datetime


# ============ News (yangiliklar — til bo'yicha) ============
class NewsOut(BaseModel):
    id: int
    title: str
    body: str
    image_url: str = ""
    created_at: datetime


# ============ Chat ============
class ChatMessageRequest(BaseModel):
    message: str


class ChatMessageOut(BaseModel):
    id: int
    username: Optional[str] = None
    display_name: Optional[str] = None
    message: str
    message_type: str = "text"
    voice_url: Optional[str] = None
    created_at: datetime


# ============ Radio / Broadcast ============
class RadioStatus(BaseModel):
    is_live: bool
    broadcaster_type: Optional[str] = None
    broadcaster_name: Optional[str] = None
    listeners_count: int = 0
    stream_url: Optional[str] = None
    use_icecast: bool = False
    current_segment: Optional[Any] = None


class RadioStatusUpdate(BaseModel):
    """radio-host yoki internal service efir holatini yangilaydi."""
    city: str
    is_live: bool = True
    broadcaster_type: Optional[str] = None   # ai | doverenniy
    broadcaster_name: Optional[str] = None
    script: Optional[str] = None
    duration_sec: int = 0


class SegmentRegister(BaseModel):
    """radio-host yangi AI ovoz segmentini ro'yxatga oladi."""
    city: str
    filename: str
    script: str = ""
    duration_sec: int = 0


class SegmentOut(BaseModel):
    id: int
    filename: str
    script: str = ""
    duration_sec: int = 0
    url: str


# ============ Admin ============
class AdminSetLevelRequest(BaseModel):
    user_id: int
    level: int  # 1, 2, 3


class AdminAddPointsRequest(BaseModel):
    user_id: int
    amount: Decimal


class AdminNewsCreate(BaseModel):
    language: str  # ru | en | lt
    title: str
    body: str
    image_url: str = ""


# ============ Generic ============
class OkResponse(BaseModel):
    ok: bool = True
    detail: Optional[Any] = None


# ============ Stats ============
class UserStatsOut(BaseModel):
    total_messages: int = 0
    chat_messages: int = 0
    voice_messages: int = 0
    studio_messages: int = 0
    file_uploads: int = 0
    points_earned: int = 0
    points_spent: int = 0
    current_points: Any = 0
    days_active: int = 0
    broadcasts_count: int = 0
    favorite_count: int = 0
    level: int = 1


# ============ Favorites ============
class FavoriteOut(BaseModel):
    id: int
    item_type: str
    item_id: int
    title: str
    content: Optional[str] = None
    broadcaster: Optional[str] = None
    duration: Optional[int] = None
    audio_url: Optional[str] = None
    created_at: datetime


class FavoriteAddRequest(BaseModel):
    item_type: str  # broadcast | message | segment
    item_id: int
    title: str
    content: Optional[str] = None
    broadcaster: Optional[str] = None
    duration: Optional[int] = None
    audio_url: Optional[str] = None


# ============ Messages (studio + voice — TZ §3) ============
class TextMessageRequest(BaseModel):
    city: str
    text: str
    lang: Optional[str] = None   # ru | en | lt


class PsychotypeOut(BaseModel):
    focus_of_attention: str
    emotional_tone: str
    key_topic: str
    priority_score: int


class MessageResponse(BaseModel):
    transcript: Optional[str] = None
    psychotype: Optional[PsychotypeOut] = None
    ai_reply: Optional[str] = None
    voice_url: Optional[str] = None
    file_url: Optional[str] = None
    points: Optional[Any] = None
