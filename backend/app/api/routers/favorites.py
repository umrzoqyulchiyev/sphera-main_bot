"""User favorites endpoints.

Allows users to save and manage favorite content:
- Broadcasts (audio segments from radio)
- Messages (interesting chat messages)
- Segments (specific audio pieces)
"""
from fastapi import APIRouter, Depends, HTTPException

from app.core.database import db
from app.core.models import FavoriteOut, FavoriteAddRequest, OkResponse
from app.core.dependencies import get_current_user

router = APIRouter(prefix="/users", tags=["favorites"])

VALID_ITEM_TYPES = {"broadcast", "message", "segment"}


@router.get("/favorites", response_model=list[FavoriteOut])
async def get_favorites(user: dict = Depends(get_current_user)):
    """Get all favorites for the current user.
    
    Returns favorites ordered by creation date (newest first).
    Includes all metadata needed to display and play content.
    """
    rows = await db.fetch(
        """
        SELECT 
            id,
            item_type,
            item_id,
            title,
            content,
            broadcaster,
            duration,
            audio_url,
            created_at
        FROM favorites
        WHERE user_id = $1
        ORDER BY created_at DESC
        """,
        user["id"]
    )
    
    return [
        FavoriteOut(
            id=row["id"],
            item_type=row["item_type"],
            item_id=row["item_id"],
            title=row["title"],
            content=row["content"],
            broadcaster=row["broadcaster"],
            duration=row["duration"],
            audio_url=row["audio_url"],
            created_at=row["created_at"],
        )
        for row in rows
    ]


@router.post("/favorites", response_model=FavoriteOut)
async def add_favorite(
    payload: FavoriteAddRequest,
    user: dict = Depends(get_current_user)
):
    """Add an item to favorites.
    
    Validates:
    - item_type is one of: broadcast, message, segment
    - No duplicate (same item_type + item_id for this user)
    
    Returns the created favorite with generated ID.
    """
    # Validate item type
    if payload.item_type not in VALID_ITEM_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid item_type. Must be one of: {', '.join(VALID_ITEM_TYPES)}"
        )
    
    # Check for duplicate
    existing = await db.fetchrow(
        """
        SELECT id FROM favorites
        WHERE user_id = $1 AND item_type = $2 AND item_id = $3
        """,
        user["id"],
        payload.item_type,
        payload.item_id
    )
    
    if existing:
        raise HTTPException(
            status_code=409,
            detail="This item is already in favorites"
        )
    
    # Insert
    row = await db.fetchrow(
        """
        INSERT INTO favorites (
            user_id,
            item_type,
            item_id,
            title,
            content,
            broadcaster,
            duration,
            audio_url
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, item_type, item_id, title, content, broadcaster, 
                  duration, audio_url, created_at
        """,
        user["id"],
        payload.item_type,
        payload.item_id,
        payload.title,
        payload.content,
        payload.broadcaster,
        payload.duration,
        payload.audio_url
    )
    
    return FavoriteOut(
        id=row["id"],
        item_type=row["item_type"],
        item_id=row["item_id"],
        title=row["title"],
        content=row["content"],
        broadcaster=row["broadcaster"],
        duration=row["duration"],
        audio_url=row["audio_url"],
        created_at=row["created_at"],
    )


@router.delete("/favorites/{favorite_id}", response_model=OkResponse)
async def remove_favorite(
    favorite_id: int,
    user: dict = Depends(get_current_user)
):
    """Remove an item from favorites.
    
    Only the owner can delete their own favorites.
    Returns 404 if not found or not owned by current user.
    """
    result = await db.execute(
        """
        DELETE FROM favorites
        WHERE id = $1 AND user_id = $2
        """,
        favorite_id,
        user["id"]
    )
    
    # Check if any row was deleted
    if result.endswith("0"):
        raise HTTPException(
            status_code=404,
            detail="Favorite not found or you don't have permission to delete it"
        )
    
    return OkResponse(detail={"favorite_id": favorite_id, "deleted": True})


@router.get("/favorites/check/{item_type}/{item_id}")
async def check_favorite(
    item_type: str,
    item_id: int,
    user: dict = Depends(get_current_user)
):
    """Check if an item is in favorites.
    
    Useful for UI to show/hide the "Add to favorites" button.
    Returns: {"is_favorite": true/false, "favorite_id": int or null}
    """
    if item_type not in VALID_ITEM_TYPES:
        raise HTTPException(status_code=400, detail="Invalid item_type")
    
    row = await db.fetchrow(
        """
        SELECT id FROM favorites
        WHERE user_id = $1 AND item_type = $2 AND item_id = $3
        """,
        user["id"],
        item_type,
        item_id
    )
    
    return {
        "is_favorite": row is not None,
        "favorite_id": row["id"] if row else None
    }
