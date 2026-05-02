# Padeladd Development Rules

This document outlines the coding standards, design principles, and technical constraints for the Padeladd project. All developers must adhere to these rules to ensure consistency and maintainability.

## Application Architecture

- **Mobile-first Single Page Application (SPA).**
- **AJAX-only**: No full page reloads allowed. Use the `fetch` API via the centralized `API` object.
- **Frontend Logic**: Lives in `/frontend/js`. It interacts exclusively with `/backend/api` endpoints.
- **State Management**: Use `localStorage` for persistent data (Auth tokens) and `sessionStorage` for ephemeral UI states.

## Design System (Vanilla CSS)

We use a modern, dark-themed design system.
- **Font**: Montserrat (Primary), Monospace (for codes/IDs).
- **Core Colors**:
  - Background: `#171C26`
  - Primary Text: `#FFFFFF`
  - Muted Text: `#A0A0A0`
  - Borders: `#3B475B`
- **Action Colors**:
  - Primary Button: `#1B52CE`
  - Secondary Button: `#293342`
  - Accents: Orange (`#F7941D`), Green (`#00CE00`), Red (`#F15A29`)
- **Spacing**: Use a 4px/8px grid system for consistent margins and padding.

## API Standards

- **Method**: Use `POST` for all API calls (even reads) to maintain a consistent communication interface and payload handling.
- **Format**: JSON only for both requests and responses.
- **Standard Response**:
  ```json
  {
      "success": boolean,
      "message": "Human-readable string",
      "data": {} | [] | null
  }
  ```
- **Error Handling**: Never leak PHP errors or HTML logic. The backend must return a structured JSON response with a relevant HTTP status code (400, 401, 403, 404, 500).

## Database Rules (MySQL)

- **Naming**: Use `snake_case` for all tables and columns.
- **Keys**: Primary keys must be named `id`. Foreign keys must follow the `{table_singular}_id` pattern.
- **Timestamps**: Every primary table must have `created_at` and `updated_at`.
- **Integrity**: Always use foreign keys with appropriate `ON DELETE` actions (CASCADE or SET NULL).

## Security Practices

- **Sanitization**: Validate and sanitize all input on **both** frontend and backend.
- **SQL Injection**: Use PDO prepared statements for **all** database queries.
- **Passwords**: Must be hashed using `password_hash()` with the default algorithm.
- **Authentication**: Protect private endpoints by checking for a valid `auth_token` in the session/database.

## Authentication & Verification Flow

1.  **Registration**: Requires basic info. Users are initially "unverified".
2.  **Verification**: Users must verify both Email and Phone via OTP/Magic Link before accessing the dashboard.
3.  **Profile Completion**: Users must finalize their profile (Nickname, Level, Side) before participating in matches.

---
[Back to README](README.md)
