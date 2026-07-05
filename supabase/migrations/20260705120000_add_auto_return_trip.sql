ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS auto_return_trip boolean NOT NULL DEFAULT false;
