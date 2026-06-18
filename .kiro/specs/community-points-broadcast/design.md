# Design Document — community-points-broadcast

## Overview

This design extends the existing Sfera5 Radio platform with three capabilities defined in the PDF specification but not yet implemented:

1. **Community-bound access** — only members of one designated Telegram group may use the system.
2. **Automatic points & role progression** — points are awarded automatically from activity and roles are promoted at thresholds.
3. **Direct live broadcast (WebSocket → Icecast)** — a `doverenniy` user's microphone audio is streamed over WebSocket to the backend, relayed into Icecast, and heard by the whole community.

The design integrates into the current stack without breaking working features:
- Backend: Python + FastAPI + asyncpg + PostgreSQL
- Real-time: native FastAPI WebSocket with `ConnectionManager` (`ws_manager.py`)
- Auth: JWT keyed on `telegram_id` (`dependencies.py`)
- Radio: Icecast (production) / AI segment playlist (dev), toggled by `USE_ICECAST`
- Frontend: Vanilla JS Mini App

## Architecture

```mermaid
flowchart TD
    subgraph TG[Telegram]
        U[User in Mini App]
        BotAPI[Telegram Bot API\ngetChatMember]
    end

    subgraph FE[Mini App - Vanilla JS]
        Auth[authenticate]
        Mic[MediaRecorder mic]
        Player[audio player]
    end

    subgraph BE[FastAPI backend]
        AuthR[routers/auth.py]
        Deps[dependencies.py\nget_current_user + membership cache]
        MV[services/membership.py\nMembership_Verifier]
        PS[services/points.py\nPoints_Service]
        BS[services/broadcast.py\nBroadcast_Service]
        MsgR[routers/messages.py]
        ChatR[routers/chat.py]
        RadioR[routers/radio.py]
        WS[ws_manager.py]
    end

    subgraph DB[(PostgreSQL)]
        Users[users]
        PH[points_history]
    end

    subgraph IC[Icecast]
        Mount[/city mountpoint/]
    end

    U --> Auth --> AuthR --> MV --> BotAPI
    AuthR --> Users
    Deps --> MV
    MsgR -->|+10| PS
    ChatR -->|+1| PS
    ChatR -->|listen minute +1| PS
    PS --> Users
    PS --> PH
    PS -->|role promoted| WS --> U
    Mic -->|audio frames WS| BS -->|ffmpeg stdin| Mount
    Mount -->|stream URL| Player
    BS --> RadioR
```

## Components and Interfaces

### 1. Membership_Verifier — `services/membership.py` (new)

Verifies that a `telegram_id` belongs to the configured Community_Group via the Telegram Bot API.

```python
# Configuration (from environment)
COMMUNITY_CHAT_ID: str          # e.g. "-1001234567890"
BOT_TOKEN: str
DISABLE_GROUP_CHECK: bool        # dev bypass, default False

ALLOWED_STATUSES = {"creator", "administrator", "member", "restricted"}

async def check_membership(telegram_id: int) -> bool:
    """Calls getChatMember; returns True if status in ALLOWED_STATUSES.
    If DISABLE_GROUP_CHECK is true, always returns True (dev mode)."""

# In-memory re-verification cache (Requirement 1.6)
# dict[telegram_id, tuple[bool, float]]  -> (is_member, checked_at_epoch)
_CACHE_TTL = 600  # seconds

async def is_member_cached(telegram_id: int) -> bool:
    """Returns cached result if checked within _CACHE_TTL, else re-checks."""
```

- Telegram call: `GET https://api.telegram.org/bot{BOT_TOKEN}/getChatMember?chat_id={COMMUNITY_CHAT_ID}&user_id={telegram_id}` via `httpx.AsyncClient` (timeout 10s).
- On HTTP/network error or `ok: false` indicating user not found → treated as non-member (returns False).
- Startup check (in `main.py` lifespan): if `COMMUNITY_CHAT_ID` is empty **and** `DISABLE_GROUP_CHECK` is false → log a configuration error. In dev (`DISABLE_GROUP_CHECK=true`) startup proceeds and all checks pass (preserves current tunnel testing).

**Integration points:**
- `routers/auth.py` → call `check_membership` before issuing JWT; deny with 403 if not a member.
- `dependencies.py:get_current_user` → after decoding token, call `is_member_cached`; raise 403 if not a member.
- `routers/chat.py` WebSocket → call `is_member_cached`; close with code `4403` if not a member.

### 2. Points_Service — `services/points.py` (new)

Awards points atomically and triggers role promotion.

```python
# Point values (Requirements 2.x)
POINTS_APPEAL = 10        # voice/text murojaat
POINTS_CHAT = 1           # chat message
POINTS_LISTEN = 1         # per listening minute

# Daily caps (UTC)
CAP_CHAT_PER_DAY = 20
CAP_LISTEN_PER_DAY = 30

# Role thresholds (Requirements 3.1)
ROLE_THRESHOLDS = [("doverenniy", 200), ("aktivniy", 50), ("slusatel", 0)]

async def award(user_id: int, event_type: str, amount: int,
                daily_cap: int | None = None) -> dict:
    """1. If daily_cap set, check today's awarded sum for this event_type;
          clamp amount so the cap is not exceeded (Requirements 2.3, 2.5).
       2. Atomic: UPDATE users SET points = points + $amount
                  WHERE id = $user_id RETURNING points, role, telegram_id.
       3. Insert points_history row (event_type, amount, created_at).
       4. Call maybe_promote(...) with new points + current role.
       Returns {points, role, promoted: bool, new_role}."""

async def _today_awarded(user_id: int, event_type: str) -> int:
    """SUM(amount) from points_history WHERE user_id AND event_type
       AND created_at >= date_trunc('day', now() at time zone 'utc')."""

def role_for_points(points: int) -> str:
    """Highest non-admin role whose threshold <= points."""

async def maybe_promote(user_id, telegram_id, points, current_role) -> tuple[bool, str]:
    """If current_role == 'admin' -> no change (3.4).
       target = role_for_points(points).
       If level(target) > level(current_role): UPDATE role; return (True, target).
       Never lowers role (3.5). On promotion, notify via ws_manager (3.6)."""
```

**Atomicity (Requirement 2.7):** all balance updates use a single SQL `UPDATE ... SET points = points + $n ... RETURNING points` so concurrent events cannot overwrite each other.

**Role promotion notification (Requirement 3.6):** on promotion, push a WebSocket event to the user's city room:
```json
{ "type": "role_up", "data": { "telegram_id": 123, "role": "aktivniy" } }
```
The frontend shows a toast and refreshes the profile.

**Integration points:**
- `routers/messages.py` `voice_message` and `text_message` → `await points.award(user_id, "appeal", 10)`
- `routers/chat.py` post + WS chat → `await points.award(user_id, "chat", 1, daily_cap=20)`
- Listening minutes → see Listening Tracker below.

### 3. Listening Tracker (within `routers/chat.py` WebSocket lifecycle)

A user is "listening" while they hold an open chat WebSocket for a city and the radio is live. We award 1 point per completed minute (cap 30/day).

- On WS connect: record `connected_at` and start a per-connection `asyncio` task that sleeps 60s in a loop and calls `points.award(user_id, "listen", 1, daily_cap=30)` each iteration.
- On WS disconnect: cancel the task.
- This reuses the existing chat WebSocket (no new socket needed); the chat socket already represents an active in-app session.

### 4. Broadcast_Service — `services/broadcast.py` (new)

Receives live audio frames over WebSocket and relays them to Icecast through an FFmpeg subprocess.

```python
# One active broadcaster per city (Requirement 5.5)
_active: dict[str, "BroadcastSession"]   # city -> session

class BroadcastSession:
    city: str
    broadcaster_name: str
    proc: subprocess.Popen   # ffmpeg, stdin=PIPE

    def start(self):
        """Spawn ffmpeg reading webm/opus from stdin, publishing to Icecast:
           ffmpeg -i pipe:0 -c:a libmp3lame -b:a 128k -ar 44100 -ac 2
                  -content_type audio/mpeg -f mp3
                  icecast://source:{ICECAST_PASS}@{ICECAST_HOST}:{ICECAST_PORT}/{city}"""

    def write(self, chunk: bytes):
        """proc.stdin.write(chunk)"""

    def stop(self):
        """Close stdin, terminate ffmpeg."""

async def open_session(city, name) -> BroadcastSession | None  # None if busy
async def feed(city, chunk: bytes)
async def close_session(city)
```

**New WebSocket endpoint** in `routers/radio.py`:
```
WS /radio/{city}/broadcast/ws?token=<jwt>
```
- Decode token → require role level >= `doverenniy` (Requirement 5.2); else close `4403`.
- If city already has an active session → close with a message (Requirement 5.5).
- Else `open_session`, set radio status live + broadcaster_type `doverenniy` (5.4), broadcast `radio_status` to listeners.
- Loop: `receive_bytes()` → `broadcast.feed(city, chunk)`. On `WebSocketDisconnect` → `close_session`, set status not-live, broadcast update (5.6).
- If feed/ffmpeg fails → send `{ "type": "broadcast_error" }` to broadcaster and close (5.7).

**Dev mode (Requirement 6.5):** if `USE_ICECAST` is false, the broadcast WS immediately returns a message `{ "type": "broadcast_unavailable", "reason": "icecast_disabled" }` and closes. The AI segment playlist keeps working unchanged. Live audio requires Icecast (production).

### 5. Frontend changes — `miniapp/app.js`

`toggleLive()` is rewritten to actually capture and stream audio:
```js
// start
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
const ws = new WebSocket(`${WS_URL}/radio/${CITY}/broadcast/ws?token=${token}`);
ws.binaryType = "arraybuffer";
const rec = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
rec.ondataavailable = e => { if (e.data.size && ws.readyState===1) e.data.arrayBuffer().then(b=>ws.send(b)); };
rec.start(500); // 500ms chunks
// stop: rec.stop(); stream tracks stop; ws.close();
```
- Listeners: when `radio_status` arrives with `broadcaster_type === "doverenniy"` and `use_icecast`, the player switches `audio.src` to the Icecast stream URL (`RADIO_URL/{city}`).
- If `broadcast_unavailable` received → toast "Прямой эфир доступен только на сервере (Icecast)".

## Data Models

### New table: `points_history`
```sql
CREATE TABLE IF NOT EXISTS points_history (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
    event_type  VARCHAR(20) NOT NULL,   -- 'appeal' | 'chat' | 'listen' | 'admin'
    amount      INTEGER NOT NULL,
    created_at  TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_points_history_user_day
    ON points_history(user_id, event_type, created_at DESC);
```

`users` table is unchanged (existing `points` and `role` columns are reused).

### Configuration additions (`.env`)
```
COMMUNITY_CHAT_ID=          # Telegram group chat id; empty in dev
DISABLE_GROUP_CHECK=true    # dev: bypass membership; production: false
```

## Error Handling

| Scenario | Handling |
|---|---|
| getChatMember network/API error | Treat as non-member → 403 (R1.4); membership cache not updated on transient error retry next request |
| COMMUNITY_CHAT_ID missing, DISABLE_GROUP_CHECK=false | Startup logs config error (R1.5) |
| Concurrent point awards | Atomic `points = points + n` (R2.7) |
| Daily cap reached | Award clamped to 0 additional (R2.3, R2.5) |
| Second broadcaster for same city | Rejected with "city already live" (R5.5) |
| FFmpeg/relay failure | Log + `broadcast_error` to broadcaster + close (R5.7) |
| Live audio while USE_ICECAST=false | `broadcast_unavailable`; fall back to AI playlist (R6.5) |

## Testing Strategy

- **Points unit tests**: award appeal/chat/listen; verify amounts, daily caps clamp at 20/30, atomic increment, history rows written.
- **Role promotion tests**: 49→no promo, 50→aktivniy, 200→doverenniy (direct skip from slusatel), admin unchanged, no demotion.
- **Membership tests**: mock getChatMember statuses (member→allow, kicked/left→403); cache returns within TTL without re-calling; WS rejects non-member with 4403; DISABLE_GROUP_CHECK bypass.
- **Broadcast tests**: doverenniy opens session; non-doverenniy rejected; second broadcaster rejected; disconnect sets not-live; dev-mode returns broadcast_unavailable.
- **Privacy test**: other users' payloads (chat/presence/status) never include points (R4.3).
- **Integration (manual, tunnel)**: send voice → +10 → reach threshold → role_up toast; doverenniy live broadcast audible to a second listener (requires Icecast/server).

## Correctness Properties

These invariants must always hold and form the basis of the test suite.

### Property 1: Points are monotonic per award
An automatic award never decreases `points`; after daily-cap clamping `amount >= 0`.
**Validates: Requirements 2.1, 2.2, 2.4**

### Property 2: Daily caps are never exceeded
For any user and UTC day, `SUM(points_history.amount WHERE event_type='chat') <= 20` and `SUM(... event_type='listen') <= 30`.
**Validates: Requirements 2.3, 2.5**

### Property 3: Role is promotion-only
After any award, `level(new_role) >= level(old_role)`, and the `admin` role is never changed by the Points_Service.
**Validates: Requirements 3.4, 3.5**

### Property 4: Role matches points
For non-admin users, whenever a promotion occurs `new_role == role_for_points(points)`; a user is never promoted above what their points allow.
**Validates: Requirements 3.1, 3.2, 3.3**

### Property 5: Atomic balance
Concurrent awards for one user yield a final balance equal to the sum of all awards (no lost updates).
**Validates: Requirements 2.6, 2.7**

### Property 6: Membership gate is total
Every JWT issuance, every protected request (subject to the 600s cache), and every WebSocket open is preceded by a membership check; a non-member can hold no valid session.
**Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.6, 1.7**

### Property 7: Single broadcaster per city
At most one active `BroadcastSession` exists per city at any time.
**Validates: Requirements 5.5**

### Property 8: Live status reflects reality
`radio status live + broadcaster_type=doverenniy` holds if and only if a `BroadcastSession` is active for that city; on session close the status becomes not-live within 5 seconds.
**Validates: Requirements 5.1, 5.4, 5.6, 6.3, 6.4**

### Property 9: Points privacy
Points never appear in chat, presence, or radio-status payloads sent to other users.
**Validates: Requirements 4.1, 4.2, 4.3**

### Property 10: Dev safety
When `USE_ICECAST=false`, no FFmpeg/Icecast process is spawned and the AI segment playlist behavior is unchanged.
**Validates: Requirements 6.5**

## Design Decisions

1. **Reuse the chat WebSocket for listening minutes** rather than a new socket — the chat WS already represents an active session, keeping the client simple.
2. **FFmpeg subprocess with stdin pipe** for live relay — mirrors the proven `radio-host/main.py` Icecast pattern; no extra media-server dependency.
3. **In-memory membership cache (600s)** — avoids hitting Telegram on every request while honoring R1.6; acceptable because a single backend instance is used (matches current deployment).
4. **Dev bypass via `DISABLE_GROUP_CHECK`** — preserves the current tunnel-based testing flow where there is no real group binding yet; production sets it false.
5. **Promotion-only role logic** — points never demote a user (R3.5); admin is never auto-changed (R3.4).
