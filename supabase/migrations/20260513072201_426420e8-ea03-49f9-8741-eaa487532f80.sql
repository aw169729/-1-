-- Add row ownership to domain data tables so RLS can enforce per-user access.
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS owner_user_id uuid DEFAULT auth.uid();

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS owner_user_id uuid DEFAULT auth.uid();

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS owner_user_id uuid DEFAULT auth.uid();

ALTER TABLE public.phone_routing
  ADD COLUMN IF NOT EXISTS owner_user_id uuid DEFAULT auth.uid();

CREATE INDEX IF NOT EXISTS clients_owner_user_id_idx ON public.clients(owner_user_id);
CREATE INDEX IF NOT EXISTS trips_owner_user_id_idx ON public.trips(owner_user_id);
CREATE INDEX IF NOT EXISTS payments_owner_user_id_idx ON public.payments(owner_user_id);
CREATE INDEX IF NOT EXISTS phone_routing_owner_user_id_idx ON public.phone_routing(owner_user_id);

-- Ensure RLS is enabled on every public application table.
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phone_routing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_page_permissions ENABLE ROW LEVEL SECURITY;

-- Replace clients policies: admins all, regular users own rows only.
DROP POLICY IF EXISTS "View clients" ON public.clients;
DROP POLICY IF EXISTS "Insert clients" ON public.clients;
DROP POLICY IF EXISTS "Update clients" ON public.clients;
DROP POLICY IF EXISTS "Delete clients" ON public.clients;

CREATE POLICY "Admins or owners can view clients"
ON public.clients
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR owner_user_id = auth.uid());

CREATE POLICY "Admins or owners can create clients"
ON public.clients
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR owner_user_id = auth.uid());

CREATE POLICY "Admins or owners can update clients"
ON public.clients
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR owner_user_id = auth.uid())
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR owner_user_id = auth.uid());

CREATE POLICY "Admins or owners can delete clients"
ON public.clients
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR owner_user_id = auth.uid());

-- Replace trips policies: admins all, regular users own rows only.
DROP POLICY IF EXISTS "View trips" ON public.trips;
DROP POLICY IF EXISTS "Insert trips" ON public.trips;
DROP POLICY IF EXISTS "Update trips" ON public.trips;
DROP POLICY IF EXISTS "Delete trips" ON public.trips;

CREATE POLICY "Admins or owners can view trips"
ON public.trips
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR owner_user_id = auth.uid());

CREATE POLICY "Admins or owners can create trips"
ON public.trips
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR owner_user_id = auth.uid());

CREATE POLICY "Admins or owners can update trips"
ON public.trips
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR owner_user_id = auth.uid())
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR owner_user_id = auth.uid());

CREATE POLICY "Admins or owners can delete trips"
ON public.trips
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR owner_user_id = auth.uid());

-- Replace payments policies: admins all, regular users own rows only.
DROP POLICY IF EXISTS "View payments" ON public.payments;
DROP POLICY IF EXISTS "Insert payments" ON public.payments;
DROP POLICY IF EXISTS "Update payments" ON public.payments;
DROP POLICY IF EXISTS "Delete payments" ON public.payments;

CREATE POLICY "Admins or owners can view payments"
ON public.payments
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR owner_user_id = auth.uid());

CREATE POLICY "Admins or owners can create payments"
ON public.payments
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR owner_user_id = auth.uid());

CREATE POLICY "Admins or owners can update payments"
ON public.payments
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR owner_user_id = auth.uid())
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR owner_user_id = auth.uid());

CREATE POLICY "Admins or owners can delete payments"
ON public.payments
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR owner_user_id = auth.uid());

-- Replace phone_routing policies: admins all, regular users own rows only.
DROP POLICY IF EXISTS "View phone_routing" ON public.phone_routing;
DROP POLICY IF EXISTS "Insert phone_routing" ON public.phone_routing;
DROP POLICY IF EXISTS "Update phone_routing" ON public.phone_routing;
DROP POLICY IF EXISTS "Delete phone_routing" ON public.phone_routing;

CREATE POLICY "Admins or owners can view phone routing"
ON public.phone_routing
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR owner_user_id = auth.uid());

CREATE POLICY "Admins or owners can create phone routing"
ON public.phone_routing
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR owner_user_id = auth.uid());

CREATE POLICY "Admins or owners can update phone routing"
ON public.phone_routing
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR owner_user_id = auth.uid())
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR owner_user_id = auth.uid());

CREATE POLICY "Admins or owners can delete phone routing"
ON public.phone_routing
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR owner_user_id = auth.uid());

-- Settings are system-wide and should be admin-only.
DROP POLICY IF EXISTS "View settings" ON public.settings;
DROP POLICY IF EXISTS "Insert settings" ON public.settings;
DROP POLICY IF EXISTS "Update settings" ON public.settings;
DROP POLICY IF EXISTS "Delete settings" ON public.settings;

CREATE POLICY "Admins can view settings"
ON public.settings
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can create settings"
ON public.settings
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update settings"
ON public.settings
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete settings"
ON public.settings
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Harden role policies: users can only read their own role; admins manage all.
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;

CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can create roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Harden page permission policies: users can only read their own permissions; admins manage all.
DROP POLICY IF EXISTS "Users can view own permissions" ON public.user_page_permissions;
DROP POLICY IF EXISTS "Admins can view all permissions" ON public.user_page_permissions;
DROP POLICY IF EXISTS "Admins can insert permissions" ON public.user_page_permissions;
DROP POLICY IF EXISTS "Admins can update permissions" ON public.user_page_permissions;
DROP POLICY IF EXISTS "Admins can delete permissions" ON public.user_page_permissions;

CREATE POLICY "Users can view own permissions"
ON public.user_page_permissions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all permissions"
ON public.user_page_permissions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can create permissions"
ON public.user_page_permissions
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update permissions"
ON public.user_page_permissions
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete permissions"
ON public.user_page_permissions
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));