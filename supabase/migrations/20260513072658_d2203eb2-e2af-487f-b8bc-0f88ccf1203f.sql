CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;
REVOKE EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated;

ALTER POLICY "Admins or owners can view clients" ON public.clients
USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR owner_user_id = auth.uid());
ALTER POLICY "Admins or owners can create clients" ON public.clients
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role) OR owner_user_id = auth.uid());
ALTER POLICY "Admins or owners can update clients" ON public.clients
USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR owner_user_id = auth.uid())
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role) OR owner_user_id = auth.uid());
ALTER POLICY "Admins or owners can delete clients" ON public.clients
USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR owner_user_id = auth.uid());

ALTER POLICY "Admins or owners can view trips" ON public.trips
USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR owner_user_id = auth.uid());
ALTER POLICY "Admins or owners can create trips" ON public.trips
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role) OR owner_user_id = auth.uid());
ALTER POLICY "Admins or owners can update trips" ON public.trips
USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR owner_user_id = auth.uid())
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role) OR owner_user_id = auth.uid());
ALTER POLICY "Admins or owners can delete trips" ON public.trips
USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR owner_user_id = auth.uid());

ALTER POLICY "Admins or owners can view payments" ON public.payments
USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR owner_user_id = auth.uid());
ALTER POLICY "Admins or owners can create payments" ON public.payments
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role) OR owner_user_id = auth.uid());
ALTER POLICY "Admins or owners can update payments" ON public.payments
USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR owner_user_id = auth.uid())
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role) OR owner_user_id = auth.uid());
ALTER POLICY "Admins or owners can delete payments" ON public.payments
USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR owner_user_id = auth.uid());

ALTER POLICY "Admins or owners can view phone routing" ON public.phone_routing
USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR owner_user_id = auth.uid());
ALTER POLICY "Admins or owners can create phone routing" ON public.phone_routing
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role) OR owner_user_id = auth.uid());
ALTER POLICY "Admins or owners can update phone routing" ON public.phone_routing
USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR owner_user_id = auth.uid())
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role) OR owner_user_id = auth.uid());
ALTER POLICY "Admins or owners can delete phone routing" ON public.phone_routing
USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR owner_user_id = auth.uid());

ALTER POLICY "Admins can view settings" ON public.settings
USING (private.has_role(auth.uid(), 'admin'::public.app_role));
ALTER POLICY "Admins can create settings" ON public.settings
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
ALTER POLICY "Admins can update settings" ON public.settings
USING (private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
ALTER POLICY "Admins can delete settings" ON public.settings
USING (private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY "Admins can view all roles" ON public.user_roles
USING (private.has_role(auth.uid(), 'admin'::public.app_role));
ALTER POLICY "Admins can create roles" ON public.user_roles
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
ALTER POLICY "Admins can update roles" ON public.user_roles
USING (private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
ALTER POLICY "Admins can delete roles" ON public.user_roles
USING (private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY "Admins can view all permissions" ON public.user_page_permissions
USING (private.has_role(auth.uid(), 'admin'::public.app_role));
ALTER POLICY "Admins can create permissions" ON public.user_page_permissions
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
ALTER POLICY "Admins can update permissions" ON public.user_page_permissions
USING (private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
ALTER POLICY "Admins can delete permissions" ON public.user_page_permissions
USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP FUNCTION IF EXISTS public.has_page_permission(uuid, text, boolean);
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);