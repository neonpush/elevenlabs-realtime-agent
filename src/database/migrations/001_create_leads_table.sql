-- Create leads table
CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY,
  phone_number VARCHAR(20) NOT NULL,
  external_lead_id VARCHAR(100),
  name VARCHAR(255),
  move_in_date DATE,
  budget DECIMAL(10,2),
  yearly_wage VARCHAR(20), -- Range format: "20k-30k", "30k-40k", etc.
  occupation VARCHAR(20) CHECK (occupation IN ('employed', 'student')),
  contract_length INTEGER, -- in months
  email VARCHAR(255),
  preferred_time VARCHAR(100),
  property_type VARCHAR(100),
  area VARCHAR(255),
  availability TEXT[],
  completeness_level VARCHAR(20) NOT NULL CHECK (completeness_level IN ('COMPLETE', 'PARTIAL', 'MINIMAL')),
  source VARCHAR(50),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  call_sid VARCHAR(100),
  call_started_at TIMESTAMP,
  completed_at TIMESTAMP,
  call_outcome VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_leads_phone_number ON leads(phone_number);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_created_at ON leads(created_at);
CREATE INDEX idx_leads_external_id ON leads(external_lead_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE
    ON leads FOR EACH ROW EXECUTE PROCEDURE 
    update_updated_at_column(); 