-- Migration: Add property fields to leads table
-- Date: 2024-01-20

ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS address_line_1 VARCHAR(255),
ADD COLUMN IF NOT EXISTS postcode VARCHAR(20),
ADD COLUMN IF NOT EXISTS bedroom_count INTEGER,
ADD COLUMN IF NOT EXISTS availability_at DATE,
ADD COLUMN IF NOT EXISTS property_cost DECIMAL(10, 2);

-- Add comments to new columns
COMMENT ON COLUMN leads.address_line_1 IS 'Property address line 1';
COMMENT ON COLUMN leads.postcode IS 'Property postcode';
COMMENT ON COLUMN leads.bedroom_count IS 'Number of bedrooms in the property';
COMMENT ON COLUMN leads.availability_at IS 'Date when property becomes available';
COMMENT ON COLUMN leads.property_cost IS 'Monthly cost of the property'; 