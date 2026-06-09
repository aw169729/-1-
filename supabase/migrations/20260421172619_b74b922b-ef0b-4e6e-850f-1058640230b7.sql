-- Create clients table
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  aliases TEXT[] NOT NULL DEFAULT '{}',
  email TEXT,
  phone TEXT,
  vat_number TEXT,
  collection_rate NUMERIC,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view clients" ON public.clients FOR SELECT USING (true);
CREATE POLICY "Public can insert clients" ON public.clients FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update clients" ON public.clients FOR UPDATE USING (true);
CREATE POLICY "Public can delete clients" ON public.clients FOR DELETE USING (true);

-- Add client_id to trips
ALTER TABLE public.trips
  ADD COLUMN client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX idx_trips_client_id ON public.trips(client_id);
CREATE INDEX idx_clients_aliases ON public.clients USING GIN(aliases);