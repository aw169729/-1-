-- Create settings table
CREATE TABLE public.settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view settings" ON public.settings FOR SELECT USING (true);
CREATE POLICY "Public can insert settings" ON public.settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update settings" ON public.settings FOR UPDATE USING (true);
CREATE POLICY "Public can delete settings" ON public.settings FOR DELETE USING (true);

-- Seed defaults
INSERT INTO public.settings (key, value) VALUES
  ('current_billing_month', '2026-04'),
  ('current_billing_month_start', '2026-03-26')
ON CONFLICT (key) DO NOTHING;

-- Add billing_month to trips
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS billing_month text;

-- Backfill existing trips with date >= 2026-03-26 to billing_month 2026-04
UPDATE public.trips
SET billing_month = '2026-04'
WHERE trip_date >= '2026-03-26' AND billing_month IS NULL;

-- For older trips, set billing_month based on their trip_date (YYYY-MM)
UPDATE public.trips
SET billing_month = to_char(trip_date, 'YYYY-MM')
WHERE billing_month IS NULL AND trip_date IS NOT NULL;