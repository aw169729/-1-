CREATE TABLE public.phone_routing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_phone_routing_phone ON public.phone_routing(phone);
CREATE INDEX idx_phone_routing_client_id ON public.phone_routing(client_id);

ALTER TABLE public.phone_routing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view phone_routing" ON public.phone_routing FOR SELECT USING (true);
CREATE POLICY "Public can insert phone_routing" ON public.phone_routing FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update phone_routing" ON public.phone_routing FOR UPDATE USING (true);
CREATE POLICY "Public can delete phone_routing" ON public.phone_routing FOR DELETE USING (true);