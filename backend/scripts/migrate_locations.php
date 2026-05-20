<?php
require_once __DIR__ . '/../core/db.php';
$pdo = getDB();

echo "Starting migration: locations table and user_profiles relation...\n";

try {
    // 1. Create locations table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS locations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");
    echo "1. Checked/Created 'locations' table.\n";

    // 2. Insert initial locations
    $locations = ['Cairo', 'Giza', 'Alexandria', 'Sahel'];
    $stmt = $pdo->prepare("INSERT IGNORE INTO locations (name) VALUES (?)");
    foreach ($locations as $loc) {
        $stmt->execute([$loc]);
    }
    echo "2. Seeded initial locations: " . implode(', ', $locations) . ".\n";

    // 3. Add location_id to user_profiles if not exists
    $colsQuery = $pdo->query("SHOW COLUMNS FROM user_profiles LIKE 'location_id'");
    $hasLocationId = $colsQuery->fetch() !== false;

    if (!$hasLocationId) {
        $pdo->exec("ALTER TABLE user_profiles ADD COLUMN location_id INT NULL AFTER nickname");
        $pdo->exec("ALTER TABLE user_profiles ADD CONSTRAINT fk_user_profiles_location FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL");
        echo "3. Added 'location_id' column and foreign key constraint to 'user_profiles'.\n";
    } else {
        echo "3. Column 'location_id' already exists in 'user_profiles'.\n";
    }

    // 4. Backfill existing location strings
    $pdo->exec("
        UPDATE user_profiles up
        JOIN locations l ON LOWER(TRIM(up.location)) = LOWER(TRIM(l.name))
        SET up.location_id = l.id
        WHERE up.location_id IS NULL AND up.location IS NOT NULL
    ");
    echo "4. Backfilled existing locations from string values to location_id.\n";

    // 5. Drop old location column if it still exists
    $oldColQuery = $pdo->query("SHOW COLUMNS FROM user_profiles LIKE 'location'");
    if ($oldColQuery->fetch() !== false) {
        $pdo->exec("ALTER TABLE user_profiles DROP COLUMN location");
        echo "5. Dropped old 'location' column from 'user_profiles'.\n";
    } else {
        echo "5. Old 'location' column already dropped.\n";
    }

    echo "Migration completed successfully!\n";

} catch (Exception $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
    exit(1);
}
