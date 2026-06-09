ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS sort_by_date text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS sort_by_origin text DEFAULT 'none';