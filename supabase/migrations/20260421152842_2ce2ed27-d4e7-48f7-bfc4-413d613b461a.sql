CREATE TABLE public.trips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_number TEXT NOT NULL UNIQUE,
  client TEXT,
  passenger_name TEXT,
  origin TEXT,
  destination TEXT,
  price NUMERIC,
  phone TEXT,
  trip_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view trips" ON public.trips FOR SELECT USING (true);
CREATE POLICY "Public can insert trips" ON public.trips FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update trips" ON public.trips FOR UPDATE USING (true);
CREATE POLICY "Public can delete trips" ON public.trips FOR DELETE USING (true);

CREATE INDEX idx_trips_date ON public.trips(trip_date);
CREATE INDEX idx_trips_number ON public.trips(trip_number);