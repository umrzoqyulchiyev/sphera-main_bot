# Requirements Document

## Introduction

This feature extends the existing Sfera5 Radio platform (a Telegram Mini App radio community for Uzbek cities) with three capabilities that are described in the technical specification but not yet implemented:

1. **Community-bound access** — the bot and Mini App must serve exactly one designated Telegram group; only verified members of that group may use the system.
2. **Automatic points and role progression** — points are currently granted only by an admin by hand. The system must award points automatically based on user activity (sending an appeal/murojaat, posting a chat message, listening to the radio) and must automatically promote a user's role when point thresholds are reached. Points are visible only to the owning user, never publicly.
3. **Direct live broadcast (WebSocket → Icecast)** — a `doverenniy` user speaking into the microphone inside the Mini App must have their captured audio streamed over WebSocket to the backend, relayed into an Icecast mountpoint, and played back to the whole community as a real radio stream. Today only the "live status" flag changes; no real audio is transmitted.

These requirements build on the existing stack: Python + FastAPI + asyncpg + PostgreSQL, native FastAPI WebSocket with `ConnectionManager`, Icecast (production) / AI segment playlist (dev), Google Gemini, edge-tts, faster-whisper, python-telegram-bot, a Vanilla JS Mini App, and JWT auth keyed on `telegram_id` with roles `slusatel`, `aktivniy`, `doverenniy`, `admin`.

## Glossary

- **System**: The Sfera5 Radio backend (FastAPI application) together with the Telegram bot and the Mini App, considered as a whole.
- **Auth_Service**: The backend component that authenticates Telegram users and issues JWT access tokens (`routers/auth.py`, `dependencies.py`).
- **Membership_Verifier**: The backend component that confirms a `telegram_id` is a current member of the Community_Group by calling the Telegram Bot API `getChatMember` method.
- **Community_Group**: The single Telegram group, identified by the configured `COMMUNITY_CHAT_ID`, whose members are the only authorized users of the System.
- **COMMUNITY_CHAT_ID**: The configured Telegram chat identifier of the Community_Group.
- **Member_Status**: The status string returned by `getChatMember`, one of `creator`, `administrator`, `member`, `restricted`, `left`, `kicked`.
- **Points_Service**: The backend component that calculates and applies automatic point awards and triggers role promotion.
- **Points_Balance**: The integer `points` value stored on a user record.
- **Activity_Event**: A user action that qualifies for an automatic point award: sending an appeal (murojaat), posting a chat message, or accumulating radio listening time.
- **Listening_Minute**: One continuous minute during which a user holds an active radio WebSocket connection and the radio is live.
- **Role**: The user's authorization level, one of `slusatel` (level 0), `aktivniy` (level 1), `doverenniy` (level 2), `admin`.
- **Role_Threshold**: The minimum Points_Balance required to hold a given Role.
- **Broadcast_Service**: The backend component that receives live audio frames over WebSocket and relays them to Icecast.
- **Audio_Frame**: A binary chunk of encoded audio sent by the broadcaster's Mini App over the live WebSocket connection.
- **Icecast_Mountpoint**: The Icecast stream path for a given city to which live audio is published and from which listeners consume the stream.
- **Broadcaster**: A `doverenniy` (or `admin`) user who is currently transmitting live audio for a city.
- **Listener**: Any authorized user consuming the radio stream for a city.

## Requirements

### Requirement 1: Community-Bound Access Control

**User Story:** As the community owner, I want only members of my designated Telegram group to access the bot and Mini App, so that outsiders cannot use the platform.

#### Acceptance Criteria

1. WHEN a user requests authentication through the Auth_Service, THE Membership_Verifier SHALL query the Telegram Bot API `getChatMember` method using COMMUNITY_CHAT_ID and the user's telegram_id.
2. WHEN the Membership_Verifier receives a Member_Status of `creator`, `administrator`, `member`, or `restricted`, THE Auth_Service SHALL treat the user as an authorized member and issue a JWT access token.
3. IF the Membership_Verifier receives a Member_Status of `left` or `kicked`, THEN THE Auth_Service SHALL deny authentication and return HTTP status 403 with a message stating that group membership is required.
4. IF the Telegram Bot API call fails or returns an error indicating the user is not found in the Community_Group, THEN THE Auth_Service SHALL deny authentication and return HTTP status 403.
5. WHERE COMMUNITY_CHAT_ID is not configured, THE System SHALL refuse to start and SHALL log a configuration error identifying the missing COMMUNITY_CHAT_ID.
6. WHEN an authenticated request is made to any protected API endpoint with a valid JWT, THE System SHALL re-verify Community_Group membership at most once per 600 seconds per user and SHALL reject the request with HTTP status 403 IF the most recent verification returned a non-member Member_Status.
7. WHEN a user opens a radio or chat WebSocket connection, THE System SHALL verify Community_Group membership before accepting the connection and SHALL close the connection with code 4403 IF the user is not a current member.

### Requirement 2: Automatic Points Awarding

**User Story:** As a community member, I want to earn points automatically through my activity, so that my participation is recognized without manual admin intervention.

#### Acceptance Criteria

1. WHEN a user successfully submits an appeal (text or voice murojaat) through the messages endpoints, THE Points_Service SHALL add 10 points to that user's Points_Balance.
2. WHEN a user successfully posts a chat message, THE Points_Service SHALL add 1 point to that user's Points_Balance.
3. IF a user's chat-message point awards within a calendar day (UTC) have reached or exceeded 20 points, THEN THE Points_Service SHALL award 0 additional chat-message points for the remainder of that day.
4. WHEN a user completes one Listening_Minute, THE Points_Service SHALL add 1 point to that user's Points_Balance.
5. IF a user's listening point awards within a calendar day (UTC) have reached or exceeded 30 points, THEN THE Points_Service SHALL award 0 additional listening points for the remainder of that day.
6. WHEN the Points_Service applies any automatic point award, THE Points_Service SHALL record the Activity_Event type, the awarded amount, and the timestamp in a points-history record.
7. THE Points_Service SHALL apply automatic point awards as atomic increments so that concurrent Activity_Events for the same user do not overwrite each other's Points_Balance updates.

### Requirement 3: Automatic Role Promotion

**User Story:** As a community member, I want my role to be upgraded automatically when I reach a points threshold, so that I gain new capabilities as I participate more.

#### Acceptance Criteria

1. THE System SHALL define the following Role_Thresholds: `slusatel` requires 0 points, `aktivniy` requires 50 points, `doverenniy` requires 200 points.
2. WHEN a user's Points_Balance reaches or exceeds a Role_Threshold higher than the user's current Role level, THE Points_Service SHALL set the user's Role to the highest non-admin Role whose Role_Threshold the Points_Balance satisfies.
3. WHEN a user's Points_Balance reaches or exceeds 200 points while the user's current Role is `slusatel`, THE Points_Service SHALL promote the user directly to `doverenniy` without requiring an intermediate `aktivniy` step.
4. WHILE a user holds the `admin` Role, THE Points_Service SHALL leave the user's Role unchanged regardless of Points_Balance.
5. THE Points_Service SHALL only increase a user's Role level through automatic promotion and SHALL NOT decrease a user's Role level when points are awarded.
6. WHEN the Points_Service promotes a user's Role, THE System SHALL send a notification to the user stating the new Role.
7. WHEN a user's Role is promoted, THE System SHALL apply the new Role to authorization decisions on the user's next authenticated request without requiring the user to re-authenticate.

### Requirement 4: Private Points Visibility

**User Story:** As a community member, I want my points to be visible only to me, so that the community does not see a public ranking.

#### Acceptance Criteria

1. WHEN an authenticated user requests their own profile, THE System SHALL return that user's Points_Balance and Role.
2. IF a request asks for the Points_Balance of a user other than the requester, THEN THE System SHALL omit the Points_Balance from the response unless the requester holds the `admin` Role.
3. THE System SHALL exclude Points_Balance from chat messages, presence data, and radio status payloads broadcast to other users.

### Requirement 5: Live Audio Capture and Transmission

**User Story:** As a doverenniy user, I want to speak into the Mini App microphone and have my voice broadcast live, so that the whole community hears me on the radio.

#### Acceptance Criteria

1. WHEN a `doverenniy` user starts a live broadcast for a city, THE Broadcast_Service SHALL open a live audio WebSocket session for that Broadcaster and that city.
2. IF a user whose Role level is below `doverenniy` attempts to open a live audio WebSocket session, THEN THE Broadcast_Service SHALL reject the session with a 403-equivalent close code.
3. WHILE a live audio WebSocket session is open, THE Broadcast_Service SHALL accept Audio_Frames from the Broadcaster and relay them to the Icecast_Mountpoint for that city.
4. WHILE a Broadcaster is transmitting Audio_Frames for a city, THE Broadcast_Service SHALL set the radio status for that city to live with broadcaster_type `doverenniy`.
5. IF two distinct users attempt to broadcast live for the same city at the same time, THEN THE Broadcast_Service SHALL reject the second Broadcaster with a message stating the city is already live.
6. WHEN a Broadcaster stops transmitting or the live audio WebSocket session closes, THE Broadcast_Service SHALL stop publishing to the Icecast_Mountpoint and SHALL set the radio status for that city to not-live within 5 seconds.
7. IF an Audio_Frame cannot be relayed to Icecast, THEN THE Broadcast_Service SHALL log the failure and SHALL notify the Broadcaster that the broadcast was interrupted.

### Requirement 6: Live Audio Playback to the Community

**User Story:** As a community member, I want to hear the live broadcast through the Mini App, so that I can listen to the doverenniy speaker in real time.

#### Acceptance Criteria

1. WHEN a city's radio status becomes live with broadcaster_type `doverenniy`, THE System SHALL provide each connected Listener with the Icecast_Mountpoint stream URL for that city.
2. WHEN a Listener plays the live stream, THE System SHALL deliver the Broadcaster's audio from the Icecast_Mountpoint to that Listener.
3. WHILE a live broadcast is active for a city, THE System SHALL include the live status and Broadcaster display name in the radio status payload sent to Listeners.
4. WHEN a live broadcast ends, THE System SHALL notify connected Listeners that the live broadcast has ended within 5 seconds.
5. WHERE Icecast is disabled by configuration (dev mode), THE System SHALL fall back to the existing AI segment playlist mode and SHALL NOT attempt to publish live audio to Icecast.
