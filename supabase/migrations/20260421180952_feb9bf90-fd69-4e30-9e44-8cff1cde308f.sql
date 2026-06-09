ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS markup_type text,
ADD COLUMN IF NOT EXISTS markup_value numeric;