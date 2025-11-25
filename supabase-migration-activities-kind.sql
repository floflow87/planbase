-- Migration: Add missing kind values to activities table
-- This fixes the time_tracked error and adds other missing values

ALTER TABLE activities 
DROP CONSTRAINT IF EXISTS activities_kind_check;

ALTER TABLE activities 
ADD CONSTRAINT activities_kind_check 
CHECK (kind IN ('email','call','meeting','note','task','file','time_tracked','created','updated','deleted'));
