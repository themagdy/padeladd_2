# Backend Documentation

The Padeladd backend is a stateless API layer built with PHP. It focuses on security, data integrity, and providing structured responses to the frontend.

## API Dispatcher

The entry point for all API requests is `backend/api/index.php`. 

### Key Responsibilities:
1.  **CORS & Headers**: Sets appropriate headers for cross-origin requests.
2.  **Request Parsing**: Merges JSON payloads and standard POST data into a single `$data` array.
3.  **Routing**: Uses a `switch` statement on the URI path to `require` the appropriate logic script.
4.  **Global Error Catching**: Wraps logic in a `try-catch` block to return structured 500 errors instead of PHP leaks.

## Helper System

Located in `backend/helpers/`, these utilities provide common functionality:

- **`response.php`**: Provides `jsonResponse($success, $message, $data, $code)` to ensure consistent output.
- **`auth_helper.php`**: Contains logic for token validation, password hashing, and user permission checks.
- **`notification_helper.php`**: Centralized logic for creating database notifications and potentially sending push alerts.
- **`mail_helper.php`**: Wrapper for sending transactional emails (Verification, Password Reset).

## Core Configuration

- **`backend/core/db.php`**: Establishes the PDO connection. Uses `PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION` for robust error handling.
- **`backend/core/config.php`**: Contains environment-specific constants (DB credentials, API base URLs, Mail server settings).

## API Standards

1.  **Method**: All data-modifying calls **must** use `POST`.
2.  **Format**: Requests must be `application/json` or `multipart/form-data`.
3.  **Authentication**: Protected endpoints require a Bearer token in the `Authorization` header.
4.  **Validation**: Every script is responsible for validating its own input data before database interaction.

---
[Back to README](README.md)
