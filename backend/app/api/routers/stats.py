"""User statistics endpoints.

Provides detailed statistics about user activity:
- Message counts (chat, voice, studio, files)
- Points (earned, spent, current)
- Activity metrics (days active, broadcasts)
- Favorites count
- Level calculation
"""
from fastapi import APIRouter, Depends

from app.core.database import db
from app.core.models import UserStatsOut
from app.core.dependencies import get_current_user

router = APIRouter(prefix="/users", tags=["stats"])


@router.get("/stats", response_model=UserStatsOut)
async def get_user_stats(user: dict = Depends(get_current_user)):
    """Get comprehensive statistics for the current user.
    
    Calculates:
    - Message counts by type (chat, voice, studio, files)
    - Points (earned via rewards, spent via costs, current balance)
    - Activity (days active, broadcasts participated)
    - Favorites count
    - Level (points // 100 + 1)
    """
    user_id = user["id"]
    
    # Message statistics
    msg_stats = await db.fetchrow(
        """
        SELECT 
            COUNT(*) FILTER (WHERE message_type IN ('text', 'chat')) as chat_messages,
            COUNT(*) FILTER (WHERE message_type IN ('voice', 'studio_voice')) as voice_messages,
            COUNT(*) FILTER (WHERE message_type = 'studio') as studio_messages,
            COUNT(*) FILTER (WHERE message_type = 'file') as file_uploads,
            COUNT(*) as total_messages
        FROM chat_messages
        WHERE user_id = $1
        """,
        user_id
    )
    
    # Points statistics
    # Note: points_earned = initial + all rewards
    # points_spent = costs deducted
    # current = user.points (from users table)
    points_stats = await db.fetchrow(
        """
        SELECT 
            COALESCE(SUM(amount) FILTER (WHERE amount > 0), 0) as earned,
            COALESCE(SUM(ABS(amount)) FILTER (WHERE amount < 0), 0) as spent
        FROM point_transactions
        WHERE user_id = $1
        """,
        user_id
    )
    
    # Activity metrics
    activity = await db.fetchrow(
        """
        SELECT 
            COUNT(DISTINCT DATE(created_at)) as days_active
        FROM chat_messages
        WHERE user_id = $1
        """,
        user_id
    )
    
    # Broadcasts (messages that went to studio)
    broadcasts = await db.fetchrow(
        """
        SELECT COUNT(*) as count
        FROM messages
        WHERE user_id = $1 AND is_for_studio = true
        """,
        user_id
    )
    
    # Favorites count
    favorites = await db.fetchrow(
        """
        SELECT COUNT(*) as count
        FROM favorites
        WHERE user_id = $1
        """,
        user_id
    )
    
    # Current points and level
    current_points = user["points"]
    level = (current_points // 100) + 1
    
    return UserStatsOut(
        total_messages=msg_stats["total_messages"] or 0,
        chat_messages=msg_stats["chat_messages"] or 0,
        voice_messages=msg_stats["voice_messages"] or 0,
        studio_messages=msg_stats["studio_messages"] or 0,
        file_uploads=msg_stats["file_uploads"] or 0,
        points_earned=int(points_stats["earned"] or 0),
        points_spent=int(points_stats["spent"] or 0),
        current_points=current_points,
        days_active=activity["days_active"] or 0,
        broadcasts_count=broadcasts["count"] or 0,
        favorite_count=favorites["count"] or 0,
        level=level,
    )
