# Frontend Documentation

The Padeladd frontend is built with focus on speed, responsiveness, and a premium "app-like" feel. It uses vanilla technologies to maintain a low footprint and high performance.

## Core Modules

### 1. Router (`router.js`)
Handles all navigation. It maps paths to HTML templates and controller initialization functions.
- **Dynamic Routing**: Supports parameters (e.g., `/matches/:matchCode`).
- **History Management**: Tracks `navDepth` to handle mobile back-button behavior effectively.
- **Access Control**: Automatically redirects unauthenticated users to `/login` and authenticated users with incomplete profiles to `/profile/edit`.

### 2. Controllers (`controllers.js`)
A centralized logic file containing all page-specific controllers. Each controller typically has an `init()` function that:
- Fetches initial data via the API.
- Renders the UI (often using template literals).
- Attaches event listeners.
- Manages local page state.

### 3. API Wrapper (`api.js`)
A centralized utility for backend communication. It handles:
- Setting the `Authorization` header with the stored token.
- Automatic error handling for common HTTP statuses.
- Standardized response parsing.

### 4. Auth System (`auth.js`)
Manages the user's authentication state.
- **Storage**: Tokens and basic user data are stored in `localStorage`.
- **Validation**: Methods to check if a user `isAuthenticated()`, `hasProfile()`, or `hasLevel()`.

## UI Components & Design System

### Design Tokens (CSS Variables)
Defined in `frontend/css/style.css`:
- **Background**: `#171C26`
- **Primary**: `#1B52CE`
- **Secondary**: `#293342`
- **Text**: `#FFFFFF`
- **Accents**: Orange (`#ff8b00`), Green (`#00CE00`), Red (`#F15A29`)

### Global UI Helpers (`app.js`)
- `Toast`: Success/Error notification overlays.
- `ConfirmModal`: Custom replacement for standard `confirm()` with premium styling.
- `ScoreUI`: Reusable renderer for match results.
- `StatsUI`: Updates player performance cards.

## Mobile Considerations
- **Touch Targets**: All buttons and interactive elements are optimized for mobile thumbs.
- **Capacitor Integration**: Includes logic for Android physical back-button handling and iOS/Android status bar styling.

---
[Back to README](README.md)
