# Setup & Installation Guide

Follow these steps to set up the Padeladd development environment on your local machine.

## Prerequisites

- **Web Server**: Apache (MAMP, XAMPP, or similar).
- **PHP**: Version 8.1 or higher.
- **Database**: MySQL 8.0 or higher.
- **Git**: For version control.

## 1. Clone the Repository

Clone the project into your web server's document root (e.g., `/Applications/MAMP/htdocs/`):

```bash
git clone <repository-url> padeladd4
```

## 2. Database Setup

1.  Open your MySQL management tool (e.g., phpMyAdmin).
2.  Create a new database named `padeladd`.
3.  Import the schema file: `database_schema.sql`.
4.  (Optional) Run `seeder.php` via your browser to populate the database with initial data (Venues, etc.).

## 3. Configuration

### Backend Config
Open `backend/core/config.php` and update the database credentials:

```php
define('DB_HOST', 'localhost');
define('DB_NAME', 'padeladd');
define('DB_USER', 'root');
define('DB_PASS', 'root'); // Default for MAMP
```

### Frontend Config
Open `frontend/js/config.js` and ensure the `BASE_PATH` and `API_BASE_URL` match your local environment:

```javascript
const CONFIG = {
    BASE_PATH: '/padeladd4',
    API_BASE_URL: '/padeladd4/backend/api',
    // ...
};
```

## 4. Web Server Configuration

Ensure that `.htaccess` files are enabled on your server. The root `.htaccess` handles the SPA routing by redirecting all non-file/directory requests to `index.html`.

### MAMP/Apache Note:
If you are running the project in a subdirectory, the `RewriteBase` or path in `.htaccess` might need adjustments depending on your `VirtualHost` setup.

## 5. Verify Installation

1.  Start your web server.
2.  Navigate to `http://localhost/padeladd4`.
3.  You should see the login screen.
4.  Check the browser console (F12) for any failed API requests or configuration errors.

---
[Back to README](README.md)
