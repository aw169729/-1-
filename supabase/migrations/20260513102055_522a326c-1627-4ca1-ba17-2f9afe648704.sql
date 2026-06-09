
-- Helper function: check if user has view permission for a page
CREATE OR REPLACE FUNCTION private.can_view_page(_user_id uuid, _page text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_page_permissions
    WHERE user_id = _user_id AND page = _page AND can_view = true
  );
$$;

REVOKE EXECUTE ON FUNCTION private.can_view_page(uuid, text) FROM PUBLIC, anon, authenticated;

-- Helper: row owned by an admin
CREATE OR REPLACE FUNCTION private.owner_is_admin(_owner uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _owner AND role = 'admin'
  );
$$;

REVOKE EXECUTE ON FUNCTION private.owner_is_admin(uuid) FROM PUBLIC, anon, authenticated;

-- ============ TRIPS ============
DROP POLICY IF EXISTS "Admins or owners can view trips" ON public.trips;
DROP POLICY IF EXISTS "Admins or owners can create trips" ON public.trips;
DROP POLICY IF EXISTS "Admins or owners can update trips" ON public.trips;
DROP POLICY IF EXISTS "Admins or owners can delete trips" ON public.trips;

CREATE POLICY "View trips" ON public.trips FOR SELECT TO authenticated
USING (
  private.has_role(auth.uid(), 'admin'::app_role)
  OR (
    private.owner_is_admin(owner_user_id)
    AND (
      private.can_view_page(auth.uid(), 'trips')
      OR private.can_view_page(auth.uid(), 'payments')
      OR private.can_view_page(auth.uid(), 'reports')
    )
  )
);
CREATE POLICY "Admins manage trips - insert" ON public.trips FOR INSERT TO authenticated
WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage trips - update" ON public.trips FOR UPDATE TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage trips - delete" ON public.trips FOR DELETE TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role));

-- ============ CLIENTS ============
DROP POLICY IF EXISTS "Admins or owners can view clients" ON public.clients;
DROP POLICY IF EXISTS "Admins or owners can create clients" ON public.clients;
DROP POLICY IF EXISTS "Admins or owners can update clients" ON public.clients;
DROP POLICY IF EXISTS "Admins or owners can delete clients" ON public.clients;

CREATE POLICY "View clients" ON public.clients FOR SELECT TO authenticated
USING (
  private.has_role(auth.uid(), 'admin'::app_role)
  OR (
    private.owner_is_admin(owner_user_id)
    AND (
      private.can_view_page(auth.uid(), 'trips')
      OR private.can_view_page(auth.uid(), 'payments')
      OR private.can_view_page(auth.uid(), 'clients')
      OR private.can_view_page(auth.uid(), 'reports')
    )
  )
);
CREATE POLICY "Admins manage clients - insert" ON public.clients FOR INSERT TO authenticated
WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage clients - update" ON public.clients FOR UPDATE TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage clients - delete" ON public.clients FOR DELETE TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role));

-- ============ PAYMENTS ============
DROP POLICY IF EXISTS "Admins or owners can view payments" ON public.payments;
DROP POLICY IF EXISTS "Admins or owners can create payments" ON public.payments;
DROP POLICY IF EXISTS "Admins or owners can update payments" ON public.payments;
DROP POLICY IF EXISTS "Admins or owners can delete payments" ON public.payments;

CREATE POLICY "View payments" ON public.payments FOR SELECT TO authenticated
USING (
  private.has_role(auth.uid(), 'admin'::app_role)
  OR (
    private.owner_is_admin(owner_user_id)
    AND (
      private.can_view_page(auth.uid(), 'payments')
      OR private.can_view_page(auth.uid(), 'reports')
    )
  )
);
CREATE POLICY "Admins manage payments - insert" ON public.payments FOR INSERT TO authenticated
WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage payments - update" ON public.payments FOR UPDATE TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage payments - delete" ON public.payments FOR DELETE TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role));

-- ============ PHONE_ROUTING ============
DROP POLICY IF EXISTS "Admins or owners can view phone routing" ON public.phone_routing;
DROP POLICY IF EXISTS "Admins or owners can create phone routing" ON public.phone_routing;
DROP POLICY IF EXISTS "Admins or owners can update phone routing" ON public.phone_routing;
DROP POLICY IF EXISTS "Admins or owners can delete phone routing" ON public.phone_routing;

CREATE POLICY "View phone routing" ON public.phone_routing FOR SELECT TO authenticated
USING (
  private.has_role(auth.uid(), 'admin'::app_role)
  OR (
    private.owner_is_admin(owner_user_id)
    AND (
      private.can_view_page(auth.uid(), 'trips')
      OR private.can_view_page(auth.uid(), 'clients')
    )
  )
);
CREATE POLICY "Admins manage phone routing - insert" ON public.phone_routing FOR INSERT TO authenticated
WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage phone routing - update" ON public.phone_routing FOR UPDATE TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage phone routing - delete" ON public.phone_routing FOR DELETE TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role));
