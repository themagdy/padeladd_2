# Padeladd Development Rules

## Application Architecture
- **Mobile-first Single Page Application (SPA).**
- AJAX must be used for all data loading and form submissions (no page reloads allowed).
- Frontend logic lives in `/frontend`, interacting with `/backend/api` endpoints using JS `fetch` via the centralized `API` object.

## Design System
- **Font:** Montserrat
- **Colors:**
  - Background: `#171C26`
  - Primary text: `#FFFFFF`
  - Borders: `#3B475B`
  - Primary button: `#1B52CE`
  - Secondary button: `#293342`
  - Accents: Orange (`#F7941D`), Green (`#00CE00`), Red (`#F15A29`)

## API Standards
- **Format:** JSON only for requests and responses.
- **Methods:** Use `POST` for all API calls to ensure consistency.
- **Payload & Response Structure:**
  Always return the standard JSON wrapper:
  ```json
  {
      "success": boolean,
      "message": "Human-readable string/error",
      "data": {} | [] | null
  }
  ```
- **Error Handling:** Protect private endpoints. Backend returns structured JSON error responses instead of HTML logic. The SPA will display these errors gracefully without breaking the flow.

## Database Rules (MySQL)
- **Tables and Columns:** `snake_case` (e.g. `user_profiles`).
- **Keys:** Primary keys must use `id`. Foreign keys must use `{table_singular}_id`.
- **Timestamps:** Add `created_at` and `updated_at` on any primary table.
- Use explicit enums and clear states.

## Security Practices
- Protect all private endpoints with auth/session checks.
- Sanitize and validate logic on both the frontend and backend.
- Prepared statements only via PDO to prevent SQL Injection.
- Prevent duplicate form submissions visually and via backend logic if applicable.
- Passwords must be securely hashed.

## Authentication (Phase 1)
- **Token System:** Uses Bearer `auth_token` stored in localStorage.
- **Verification:** Users must verify SMS and Email via `verification_codes` before accessing the system.
- **Login check:** Login verifies `is_email_verified` and `is_phone_verified`. If incomplete, they are redirected to `/verify`.
- **Profile constraint:** After successful verification and login, if the user has no `user_profiles` row, they are routed to `/profile/edit` to finalize registration.
