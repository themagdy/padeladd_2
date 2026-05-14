<?php
/**
 * Security Helper — Centralized sanitization and protection logic.
 */
class Security {
    /**
     * Sanitizes a string by stripping HTML tags and trimming whitespace.
     * 
     * @param string $input
     * @return string
     */
    public static function sanitize($input) {
        if (!is_string($input)) return $input;
        
        // Remove HTML tags entirely
        $clean = strip_tags($input);
        
        // Trim whitespace
        $clean = trim($clean);
        
        return $clean;
    }

    /**
     * Recursively sanitizes an array of inputs.
     * 
     * @param array $data
     * @param array $exclude Keys to exclude from sanitization (e.g., passwords)
     * @return array
     */
    public static function sanitizeArray($data, $exclude = ['password', 'new_password', 'current_password', 'password_confirm']) {
        if (!is_array($data)) return $data;
        
        foreach ($data as $key => $value) {
            if (in_array($key, $exclude)) {
                continue;
            }
            
            if (is_array($value)) {
                $data[$key] = self::sanitizeArray($value, $exclude);
            } else {
                $data[$key] = self::sanitize($value);
            }
        }
        
        return $data;
    }
}
