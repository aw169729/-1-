-- Additional manual charges (moved from localStorage to cloud)
CREATE TABLE public.additional_charges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client TEXT NOT NULL,
  month TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.additional_charges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view additional_charges" ON public.additional_charges FOR SELECT USING (true);
CREATE POLICY "Public can insert additional_charges" ON public.additional_charges FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update additional_charges" ON public.additional_charges FOR UPDATE USING (true);
CREATE POLICY "Public can delete additional_charges" ON public.additional_charges FOR DELETE USING (true);

-- Excluded trip months (moved from localStorage to cloud)
CREATE TABLE public.excluded_trip_months (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client TEXT NOT NULL,
  month TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(client, month)
);

ALTER TABLE public.excluded_trip_months ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view excluded_trip_months" ON public.excluded_trip_months FOR SELECT USING (true);
CREATE POLICY "Public can insert excluded_trip_months" ON public.excluded_trip_months FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can delete excluded_trip_months" ON public.excluded_trip_months FOR DELETE USING (true);
