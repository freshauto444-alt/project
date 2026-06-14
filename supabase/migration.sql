-- Fresh Auto: Database Schema Migration
-- Run this in Supabase SQL Editor (Dashboard > SQL > New query)

-- ============================================================
-- 1. PROFILES (linked to auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'manager', 'admin')),
  avatar_url TEXT,
  notification_preferences JSONB DEFAULT '{"email": true, "sms": false}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- ============================================================
-- 2. ORDERS (6-stage pipeline)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  car_id TEXT,
  status TEXT NOT NULL DEFAULT 'new_lead' CHECK (status IN ('new_lead', 'car_selection', 'payment', 'delivery', 'customs', 'delivered')),
  manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  payment_method TEXT,
  total_price NUMERIC(12,2),
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  customer_company TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_manager_id ON public.orders(manager_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);

-- ============================================================
-- 3. ORDER NOTES (activity log)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.order_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  note_type TEXT NOT NULL DEFAULT 'note' CHECK (note_type IN ('note', 'status_change', 'assignment', 'system')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_notes_order_id ON public.order_notes(order_id);

-- ============================================================
-- 4. SAVED CARS (favorites)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.saved_cars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  car_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, car_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_cars_user_id ON public.saved_cars(user_id);

-- ============================================================
-- 5. LEADS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  email TEXT,
  phone TEXT,
  source TEXT DEFAULT 'website' CHECK (source IN ('website', 'instagram', 'phone', 'referral', 'ai_picker', 'other')),
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'lost')),
  manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  preferences JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_manager_id ON public.leads(manager_id);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS orders_updated_at ON public.orders;
CREATE TRIGGER orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS leads_updated_at ON public.leads;
CREATE TRIGGER leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_cars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Helper: check if current user is admin or manager
CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- PROFILES
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Admin read all profiles" ON public.profiles FOR SELECT USING (public.is_admin_or_manager());
CREATE POLICY "Admin update all profiles" ON public.profiles FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin')
);

-- ORDERS
CREATE POLICY "Users read own orders" ON public.orders FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users create orders" ON public.orders FOR INSERT WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "Admin read all orders" ON public.orders FOR SELECT USING (public.is_admin_or_manager());
CREATE POLICY "Admin update orders" ON public.orders FOR UPDATE USING (public.is_admin_or_manager());
CREATE POLICY "Admin insert orders" ON public.orders FOR INSERT WITH CHECK (public.is_admin_or_manager());

-- ORDER NOTES
CREATE POLICY "Users read own order notes" ON public.order_notes FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_notes.order_id AND orders.user_id = auth.uid()));
CREATE POLICY "Admin read all notes" ON public.order_notes FOR SELECT USING (public.is_admin_or_manager());
CREATE POLICY "Admin insert notes" ON public.order_notes FOR INSERT WITH CHECK (public.is_admin_or_manager());

-- SAVED CARS
CREATE POLICY "Users manage own saved cars" ON public.saved_cars FOR ALL USING (user_id = auth.uid());

-- LEADS
CREATE POLICY "Admin manage leads" ON public.leads FOR ALL USING (public.is_admin_or_manager());

-- ============================================================
-- 6. PICKER EVENTS — AI-picker learning loop (T9) + observability (T10)
-- ============================================================
-- Append-only event log written server-side via the service key (bypasses RLS).
-- T9 reads kind='suggestion_approved' to bias future suggestions toward what
-- clients actually pick; T10 reads the other kinds for hit-rate / thin-rate /
-- conversion metrics. Safe to query before any rows exist.
CREATE TABLE IF NOT EXISTS public.picker_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ts TIMESTAMPTZ DEFAULT now(),
  kind TEXT NOT NULL,            -- suggestions_shown | suggestion_approved | search_completed | car_clicked
  session_id TEXT,              -- client-generated; ties one user's flow together
  make TEXT,
  model TEXT,                   -- base model where relevant
  body_type TEXT,
  budget_min INT,
  budget_max INT,
  grounded INT,                 -- suggestions_shown: grounded count
  shown INT,                    -- suggestions_shown: total cards shown
  found INT,                    -- search_completed: result count
  meta JSONB
);

CREATE INDEX IF NOT EXISTS idx_picker_events_kind_ts ON public.picker_events(kind, ts DESC);
CREATE INDEX IF NOT EXISTS idx_picker_events_make_model ON public.picker_events(make, model);

ALTER TABLE public.picker_events ENABLE ROW LEVEL SECURITY;
-- No public/anon policy: inserts go through the server (service key). Only
-- admins/managers can read the raw event stream.
CREATE POLICY "Admin read picker events" ON public.picker_events FOR SELECT USING (public.is_admin_or_manager());
