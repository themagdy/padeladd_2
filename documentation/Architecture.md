# System Architecture

Padeladd is architected as a **Mobile-first Single Page Application (SPA)**. This document outlines the core technical decisions and communication flows within the system.

## Technology Stack

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3.
- **Backend**: PHP 8.x (using PDO for database interactions).
- **Database**: MySQL 8.x.
- **Web Server**: Apache (via `.htaccess` for routing).
- **Client Hosting**: Compatible with Capacitor for native mobile wrapping.

## The SPA Pattern

The application avoids traditional page reloads. Instead, it uses a centralized router to manage the view state:

1.  **Request**: The user navigates to a URL (e.g., `/dashboard`).
2.  **Routing**: `router.js` intercepts the request, identifies the matching route, and fetches the corresponding HTML template from `frontend/pages/`.
3.  **Injection**: The template is injected into the `#app-content` div in `index.html`.
4.  **Initialization**: The router executes the associated `init()` function from `controllers.js` to populate data and attach event listeners.

## Directory Structure

```text
/
├── assets/             # Global static assets (logos, icons)
├── backend/
│   ├── api/            # Centralized API dispatcher and endpoints
│   ├── core/           # Database connection and base config
│   ├── helpers/        # Utilities (Auth, Mail, Notifications, Response)
│   └── middleware/     # (Placeholder for future expansion)
├── documentation/      # Technical documentation
├── frontend/
│   ├── assets/         # Frontend-specific assets (page icons)
│   ├── components/     # Reusable HTML snippets (Header, Skeletons)
│   ├── css/            # Main design system and style sheets
│   ├── js/             # Core application logic
│   └── pages/          # HTML templates for different views
└── index.html          # Main entry point for the SPA
```

## Communication Flow

All data interactions occur via asynchronous `fetch` calls to the backend API.

1.  **Frontend**: Calls `API.post(endpoint, data)`.
2.  **Backend Dispatcher**: `backend/api/index.php` receives all requests, validates the method (POST), and routes to the appropriate logic script based on the URI.
3.  **Logic Execution**: The specific PHP script (e.g., `api/match/create.php`) interacts with the database.
4.  **JSON Response**: The backend returns a standardized JSON wrapper:
    ```json
    {
        "success": boolean,
        "message": "Human-readable string",
        "data": {}
    }
    ```

---
[Back to README](README.md)
