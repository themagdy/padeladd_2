-- Add thumbnail column to user_profiles
ALTER TABLE user_profiles ADD COLUMN profile_image_thumb VARCHAR(255) DEFAULT NULL AFTER profile_image;
