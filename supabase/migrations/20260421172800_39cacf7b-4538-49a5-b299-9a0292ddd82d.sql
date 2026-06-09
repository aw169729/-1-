UPDATE public.trips t
SET client_id = c.id
FROM public.clients c
WHERE t.client_id IS NULL
  AND t.client IS NOT NULL
  AND (
    btrim(t.client) = btrim(c.name)
    OR EXISTS (
      SELECT 1 FROM unnest(c.aliases) AS a
      WHERE btrim(a) = btrim(t.client)
    )
  );