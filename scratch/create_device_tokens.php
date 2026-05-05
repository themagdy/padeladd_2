<?php
require_once __DIR__ . '/../backend/core/db.php';

try {
    $pdo = getDB();
    
    $sql = "CREATE TABLE IF NOT EXISTS `user_device_tokens` (
      `id` int(11) NOT NULL AUTO_INCREMENT,
      `user_id` int(11) NOT NULL,
      `token` varchar(512) NOT NULL,
      `platform` enum('android', 'ios', 'web') DEFAULT 'android',
      `last_updated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (`id`),
      UNIQUE KEY `uq_token` (`token`(255)),
      KEY `user_id` (`user_id`),
      CONSTRAINT `user_device_tokens_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";
    
    $pdo->exec($sql);
    echo "Successfully created user_device_tokens table.\n";
    
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
