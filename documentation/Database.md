# Database Documentation

Padeladd uses a relational MySQL database. The schema is designed for scalability and maintains strict referential integrity using foreign keys.

## Logical Groupings

### 1. User Management
- **`users`**: Core account information (Email, Mobile, Password hash, Verification status).
- **`user_profiles`**: Player profile details (Nickname, Level, Playing side, Bio, Image).
- **`verification_codes`**: OTPs for Email/SMS verification.
- **`password_resets`**: Temporary tokens for account recovery.

### 2. Match Management
- **`matches`**: Defines a match event (Venue, Time, Status, Type).
- **`match_players`**: Pivot table linking `users` to `matches`. Tracks which team/slot each player occupies.
- **`waiting_list`**: Tracks requests to join full matches. Includes partner requests.
- **`venues`**: Pre-defined list of available Padel locations.
- **`venue_requests`**: User-submitted suggestions for new venues.

### 3. Social & Communication
- **`chat_messages`**: Individual messages sent within a match chat.
- **`chat_presence`**: Real-time tracking of who is currently viewing a match chat.
- **`notifications`**: System alerts (Match invites, Score approvals, etc.).
- **`phone_requests`**: Management of phone number sharing between players.

### 4. Performance & Disputes
- **`scores`**: Match result submissions. Requires approval from the opposing team.
- **`player_stats`**: Aggregated performance metrics (Points, Rank, Win rate, Streak).
- **`disputes`**: Records of challenged score submissions.
- **`match_reports` / `profile_reports`**: User-submitted reports for behavioral or technical issues.

## Key Relationships

- **User to Profile**: One-to-One (`users.id` -> `user_profiles.user_id`).
- **Match Creator**: A match is linked to its creator via `matches.creator_id`.
- **Match Participation**: Users are linked to matches via `match_players`. This table defines the `team_no` (1 or 2) and `slot_no` (1 or 2).
- **Waitlist Logic**: Users on the `waiting_list` are promoted to `match_players` when a slot becomes available.

## Status Enums

Commonly used state values:
- **Match Status**: `open`, `full`, `completed`, `cancelled`, `on_hold`.
- **Player Status**: `confirmed`, `pending`.
- **Score Status**: `pending`, `approved`, `disputed`.

---
[Back to README](README.md)
