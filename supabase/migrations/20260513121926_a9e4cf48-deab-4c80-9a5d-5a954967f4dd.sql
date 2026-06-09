-- Tighten SELECT policies: each table requires its own page permission

DROP POLICY IF EXISTS "View trips" ON public.trips;
CREATE POLICY "View trips" ON public.trips
FOR SELECT TO authenticated
USING (
  private.has_role(auth.uid(), 'admin'::app_role)
  OR (private.owner_is_admin(owner_user_id) AND private.can_view_page(auth.uid(), 'trips'))
);

DROP POLICY IF EXISTS "View clients" ON public.clients;
CREATE POLICY "View clients" ON public.clients
FOR SELECT TO authenticated
USING (
  private.has_role(auth.uid(), 'admin'::app_role)
  OR (private.owner_is_admin(owner_user_id) AND private.can_view_page(auth.uid(), 'clients'))
);

DROP POLICY IF EXISTS "View payments" ON public.payments;
CREATE POLICY "View payments" ON public.payments
FOR SELECT TO authenticated
USING (
  private.has_role(auth.uid(), 'admin'::app_role)
  OR (private.owner_is_admin(owner_user_id) AND private.can_view_page(auth.uid(), 'payments'))
);

DROP POLICY IF EXISTS "View phone routing" ON public.phone_routing;
CREATE POLICY "View phone routing" ON public.phone_routing
FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role));