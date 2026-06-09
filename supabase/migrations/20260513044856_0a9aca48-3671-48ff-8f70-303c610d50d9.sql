
-- Roles enum + table
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer role check
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert roles" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update roles" ON public.user_roles
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete roles" ON public.user_roles
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Page permissions
CREATE TABLE public.user_page_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page TEXT NOT NULL,
  can_view BOOLEAN NOT NULL DEFAULT false,
  can_edit BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, page)
);

ALTER TABLE public.user_page_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own permissions" ON public.user_page_permissions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all permissions" ON public.user_page_permissions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert permissions" ON public.user_page_permissions
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update permissions" ON public.user_page_permissions
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete permissions" ON public.user_page_permissions
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Lock down existing public tables to authenticated users only
DROP POLICY IF EXISTS "Public can view clients" ON public.clients;
DROP POLICY IF EXISTS "Public can insert clients" ON public.clients;
DROP POLICY IF EXISTS "Public can update clients" ON public.clients;
DROP POLICY IF EXISTS "Public can delete clients" ON public.clients;
CREATE POLICY "Auth can view clients" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can insert clients" ON public.clients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth can update clients" ON public.clients FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth can delete clients" ON public.clients FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Public can view payments" ON public.payments;
DROP POLICY IF EXISTS "Public can insert payments" ON public.payments;
DROP POLICY IF EXISTS "Public can update payments" ON public.payments;
DROP POLICY IF EXISTS "Public can delete payments" ON public.payments;
CREATE POLICY "Auth can view payments" ON public.payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can insert payments" ON public.payments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth can update payments" ON public.payments FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth can delete payments" ON public.payments FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Public can view trips" ON public.trips;
DROP POLICY IF EXISTS "Public can insert trips" ON public.trips;
DROP POLICY IF EXISTS "Public can update trips" ON public.trips;
DROP POLICY IF EXISTS "Public can delete trips" ON public.trips;
CREATE POLICY "Auth can view trips" ON public.trips FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can insert trips" ON public.trips FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth can update trips" ON public.trips FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth can delete trips" ON public.trips FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Public can view phone_routing" ON public.phone_routing;
DROP POLICY IF EXISTS "Public can insert phone_routing" ON public.phone_routing;
DROP POLICY IF EXISTS "Public can update phone_routing" ON public.phone_routing;
DROP POLICY IF EXISTS "Public can delete phone_routing" ON public.phone_routing;
CREATE POLICY "Auth can view phone_routing" ON public.phone_routing FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can insert phone_routing" ON public.phone_routing FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth can update phone_routing" ON public.phone_routing FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth can delete phone_routing" ON public.phone_routing FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Public can view settings" ON public.settings;
DROP POLICY IF EXISTS "Public can insert settings" ON public.settings;
DROP POLICY IF EXISTS "Public can update settings" ON public.settings;
DROP POLICY IF EXISTS "Public can delete settings" ON public.settings;
CREATE POLICY "Auth can view settings" ON public.settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can insert settings" ON public.settings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth can update settings" ON public.settings FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth can delete settings" ON public.settings FOR DELETE TO authenticated USING (true);
