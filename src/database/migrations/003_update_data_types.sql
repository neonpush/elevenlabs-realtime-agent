-- Migration: Update data types for yearly_wage and contract_length
-- Date: 2024-01-20

-- Update yearly_wage from VARCHAR to INTEGER
-- First drop the existing column if it exists as VARCHAR
ALTER TABLE leads DROP COLUMN IF EXISTS yearly_wage_old;

-- Rename current column to backup
ALTER TABLE leads RENAME COLUMN yearly_wage TO yearly_wage_old;

-- Add new column with correct type
ALTER TABLE leads ADD COLUMN yearly_wage INTEGER;

-- Comment on new column
COMMENT ON COLUMN leads.yearly_wage IS 'Annual wage in pounds (e.g., 30000 for £30k)';

-- Update contract_length from INTEGER to VARCHAR for enum values
-- First drop the existing column if it exists as INTEGER
ALTER TABLE leads DROP COLUMN IF EXISTS contract_length_old;

-- Rename current column to backup
ALTER TABLE leads RENAME COLUMN contract_length TO contract_length_old;

-- Add new column with correct type for enum
ALTER TABLE leads ADD COLUMN contract_length VARCHAR(20);

-- Add constraint to ensure only valid enum values
ALTER TABLE leads ADD CONSTRAINT contract_length_enum_check 
CHECK (contract_length IN ('LT_SIX_MONTHS', 'SIX_MONTHS', 'TWELVE_MONTHS', 'GT_TWELVE_MONTHS'));

-- Comment on new column
COMMENT ON COLUMN leads.contract_length IS 'Contract length enum: LT_SIX_MONTHS, SIX_MONTHS, TWELVE_MONTHS, GT_TWELVE_MONTHS';

-- Clean up old columns (commented out for safety - run manually if needed)
-- ALTER TABLE leads DROP COLUMN yearly_wage_old;
-- ALTER TABLE leads DROP COLUMN contract_length_old;