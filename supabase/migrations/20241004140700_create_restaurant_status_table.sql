-- Create restaurant_status table
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.restaurant_status (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  address text,
  opening_hours text,
  expected boolean,
  actual boolean,
  mismatch boolean,
  url text,
  created_at timestamptz DEFAULT now(),
  last_checked_at timestamptz DEFAULT now(),
  CONSTRAINT restaurant_unique UNIQUE (name, address)
);

-- Add a comment on the table
COMMENT ON TABLE public.restaurant_status IS 'Stores restaurant status information including expected and actual opening status';

-- Create an index on the name and address for faster lookups
CREATE INDEX IF NOT EXISTS idx_restaurant_status_name ON public.restaurant_status (name);
CREATE INDEX IF NOT EXISTS idx_restaurant_status_address ON public.restaurant_status (address);

-- Add a trigger to update last_checked_at on row update
CREATE OR REPLACE FUNCTION update_last_checked_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_checked_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_restaurant_status_last_checked
BEFORE UPDATE ON public.restaurant_status
FOR EACH ROW
EXECUTE FUNCTION update_last_checked_at();
