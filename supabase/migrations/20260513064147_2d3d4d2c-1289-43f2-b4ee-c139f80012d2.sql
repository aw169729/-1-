
-- Helper: check page permission
CREATE OR REPLACE FUNCTION public.has_page_permission(_user_id uuid, _page text, _need_edit boolean)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_page_permissions
    WHERE user_id = _user_id
      AND page = _page
      AND (CASE WHEN _need_edit THEN can_edit ELSE can_view END) = true
  )
$$;

-- TRIPS
DROP POLICY IF EXISTS "Auth can view trips" ON public.trips;
DROP POLICY IF EXISTS "Auth can insert trips" ON public.trips;
DROP POLICY IF EXISTS "Auth can update trips" ON public.trips;
DROP POLICY IF EXISTS "Auth can delete trips" ON public.trips;
CREATE POLICY "View trips" ON public.trips FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_page_permission(auth.uid(),'trips',false));
CREATE POLICY "Insert trips" ON public.trips FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_page_permission(auth.uid(),'trips',true));
CREATE POLICY "Update trips" ON public.trips FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_page_permission(auth.uid(),'trips',true));
CREATE POLICY "Delete trips" ON public.trips FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_page_permission(auth.uid(),'trips',true));

-- PAYMENTS
DROP POLICY IF EXISTS "Auth can view payments" ON public.payments;
DROP POLICY IF EXISTS "Auth can insert payments" ON public.payments;
DROP POLICY IF EXISTS "Auth can update payments" ON public.payments;
DROP POLICY IF EXISTS "Auth can delete payments" ON public.payments;
CREATE POLICY "View payments" ON public.payments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_page_permission(auth.uid(),'payments',false));
CREATE POLICY "Insert payments" ON public.payments FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_page_permission(auth.uid(),'payments',true));
CREATE POLICY "Update payments" ON public.payments FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_page_permission(auth.uid(),'payments',true));
CREATE POLICY "Delete payments" ON public.payments FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_page_permission(auth.uid(),'payments',true));

-- CLIENTS
DROP POLICY IF EXISTS "Auth can view clients" ON public.clients;
DROP POLICY IF EXISTS "Auth can insert clients" ON public.clients;
DROP POLICY IF EXISTS "Auth can update clients" ON public.clients;
DROP POLICY IF EXISTS "Auth can delete clients" ON public.clients;
CREATE POLICY "View clients" ON public.clients FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_page_permission(auth.uid(),'clients',false));
CREATE POLICY "Insert clients" ON public.clients FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_page_permission(auth.uid(),'clients',true));
CREATE POLICY "Update clients" ON public.clients FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_page_permission(auth.uid(),'clients',true));
CREATE POLICY "Delete clients" ON public.clients FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_page_permission(auth.uid(),'clients',true));

-- PHONE_ROUTING (tied to clients page)
DROP POLICY IF EXISTS "Auth can view phone_routing" ON public.phone_routing;
DROP POLICY IF EXISTS "Auth can insert phone_routing" ON public.phone_routing;
DROP POLICY IF EXISTS "Auth can update phone_routing" ON public.phone_routing;
DROP POLICY IF EXISTS "Auth can delete phone_routing" ON public.phone_routing;
CREATE POLICY "View phone_routing" ON public.phone_routing FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_page_permission(auth.uid(),'clients',false));
CREATE POLICY "Insert phone_routing" ON public.phone_routing FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_page_permission(auth.uid(),'clients',true));
CREATE POLICY "Update phone_routing" ON public.phone_routing FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_page_permission(auth.uid(),'clients',true));
CREATE POLICY "Delete phone_routing" ON public.phone_routing FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_page_permission(auth.uid(),'clients',true));

-- SETTINGS — admin only
DROP POLICY IF EXISTS "Auth can view settings" ON public.settings;
DROP POLICY IF EXISTS "Auth can insert settings" ON public.settings;
DROP POLICY IF EXISTS "Auth can update settings" ON public.settings;
DROP POLICY IF EXISTS "Auth can delete settings" ON public.settings;
CREATE POLICY "View settings" ON public.settings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_page_permission(auth.uid(),'settings',false));
CREATE POLICY "Insert settings" ON public.settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_page_permission(auth.uid(),'settings',true));
CREATE POLICY "Update settings" ON public.settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_page_permission(auth.uid(),'settings',true));
CREATE POLICY "Delete settings" ON public.settings FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_page_permission(auth.uid(),'settings',true));
