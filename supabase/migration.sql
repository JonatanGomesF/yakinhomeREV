-- ============================================================
-- YakinHome — Supabase SQL Migration
-- Versão: 1.0.0  |  Data: 2026-06-26
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. CUSTOMERS (já existe — adicionar colunas)
-- ─────────────────────────────────────────────
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS total_spent    NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS orders_count   INTEGER       DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ   DEFAULT NOW();

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS customers_updated_at ON public.customers;
CREATE TRIGGER customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────
-- 2. PROMOTIONS (já existe — adicionar colunas)
-- ─────────────────────────────────────────────
ALTER TABLE public.promotions
  ADD COLUMN IF NOT EXISTS expires_at  TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS created_at  TIMESTAMPTZ DEFAULT NOW();

-- ─────────────────────────────────────────────
-- 3. ORDERS — nova tabela de pedidos
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.orders (
  id              BIGSERIAL PRIMARY KEY,
  customer_name   TEXT        NOT NULL,
  customer_phone  TEXT        NOT NULL,
  street          TEXT        NOT NULL,
  number          TEXT        NOT NULL,
  district        TEXT        DEFAULT '',
  items           JSONB       NOT NULL DEFAULT '[]',
  total           NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_method  TEXT        NOT NULL DEFAULT 'PIX',
  change_for      NUMERIC(10,2) DEFAULT NULL,
  status          TEXT        NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','preparing','delivery','delivered','cancelled')),
  notes           TEXT        DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para queries frequentes
CREATE INDEX IF NOT EXISTS idx_orders_status      ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at  ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_phone       ON public.orders(customer_phone);

-- Trigger updated_at nos pedidos
DROP TRIGGER IF EXISTS orders_updated_at ON public.orders;
CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────
-- 4. ORDER_STATUS_HISTORY — histórico de status
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id         BIGSERIAL PRIMARY KEY,
  order_id   BIGINT      NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  old_status TEXT        DEFAULT NULL,
  new_status TEXT        NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_osh_order_id ON public.order_status_history(order_id);

-- Trigger automático para registrar mudanças de status
CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.order_status_history(order_id, old_status, new_status)
    VALUES (NEW.id, OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS orders_status_history ON public.orders;
CREATE TRIGGER orders_status_history
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION log_order_status_change();

-- ─────────────────────────────────────────────
-- 5. RESTAURANT_SETTINGS — configurações globais
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.restaurant_settings (
  id            INTEGER PRIMARY KEY DEFAULT 1,  -- single-row table
  is_open       BOOLEAN     NOT NULL DEFAULT true,
  open_time     TIME        DEFAULT '11:00',
  close_time    TIME        DEFAULT '22:00',
  delivery_fee  NUMERIC(6,2) DEFAULT 5.00,
  min_order     NUMERIC(6,2) DEFAULT 20.00,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Garante que só existe 1 linha
CREATE UNIQUE INDEX IF NOT EXISTS idx_settings_single ON public.restaurant_settings(id);

-- Inserir linha padrão se não existir
INSERT INTO public.restaurant_settings (id, is_open)
VALUES (1, true)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────
-- 6. VIEWS ÚTEIS
-- ─────────────────────────────────────────────

-- View: pedidos de hoje
CREATE OR REPLACE VIEW public.orders_today AS
SELECT *
FROM public.orders
WHERE DATE(created_at AT TIME ZONE 'America/Sao_Paulo') = CURRENT_DATE
ORDER BY created_at DESC;

-- View: receita dos últimos 7 dias agrupada por dia
CREATE OR REPLACE VIEW public.revenue_last_7_days AS
SELECT
  DATE(created_at AT TIME ZONE 'America/Sao_Paulo') AS day,
  COUNT(*)         AS orders_count,
  SUM(total)       AS revenue
FROM public.orders
WHERE
  status <> 'cancelled'
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY day
ORDER BY day ASC;

-- View: top clientes por gasto
CREATE OR REPLACE VIEW public.top_customers AS
SELECT
  id,
  name,
  phone,
  orders_count,
  total_spent,
  created_at
FROM public.customers
ORDER BY total_spent DESC
LIMIT 20;

-- ─────────────────────────────────────────────
-- 7. FUNCTION: atualizar totais do cliente após pedido
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sync_customer_totals(p_phone TEXT, p_total NUMERIC)
RETURNS VOID AS $$
BEGIN
  UPDATE public.customers
  SET
    total_spent  = COALESCE(total_spent, 0) + p_total,
    orders_count = COALESCE(orders_count, 0) + 1,
    last_order_value = p_total
  WHERE phone = p_phone;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────
-- 8. ADMINS & SEGURANÇA
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.admins (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Inserir email do admin padrão
INSERT INTO public.admins (email)
VALUES ('admin@yakinhome.com')
ON CONFLICT (email) DO NOTHING;

-- Habilita RLS na tabela admins
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- Função SECURITY DEFINER para verificar se o usuário é admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admins
    WHERE email = auth.jwt() ->> 'email'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Políticas para a tabela admins
DROP POLICY IF EXISTS admins_auth_all ON public.admins;
CREATE POLICY admins_auth_all ON public.admins
  FOR ALL
  TO authenticated
  USING (public.is_admin());

-- ─────────────────────────────────────────────
-- 9. ROW LEVEL SECURITY
-- ─────────────────────────────────────────────

-- Habilita RLS nas tabelas sensíveis
ALTER TABLE public.orders             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_settings  ENABLE ROW LEVEL SECURITY;

-- Política: apenas administradores leem/escrevem orders
DROP POLICY IF EXISTS orders_auth_all ON public.orders;
CREATE POLICY orders_auth_all ON public.orders
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Política: público pode inserir pedido (checkout) mas não ler/editar
DROP POLICY IF EXISTS orders_insert_anon ON public.orders;
CREATE POLICY orders_insert_anon ON public.orders
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Histórico: apenas admins
DROP POLICY IF EXISTS osh_auth_all ON public.order_status_history;
CREATE POLICY osh_auth_all ON public.order_status_history
  FOR ALL
  TO authenticated
  USING (public.is_admin());

-- Settings: apenas admins
DROP POLICY IF EXISTS settings_auth_all ON public.restaurant_settings;
CREATE POLICY settings_auth_all ON public.restaurant_settings
  FOR ALL
  TO authenticated
  USING (public.is_admin());

-- Customers: anon pode inserir, apenas admins leem tudo
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customers_insert_anon ON public.customers;
CREATE POLICY customers_insert_anon ON public.customers
  FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS customers_auth_all ON public.customers;
CREATE POLICY customers_auth_all ON public.customers
  FOR ALL TO authenticated USING (public.is_admin());

-- Promotions: anon lê (cardápio), apenas admins escrevem
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS promotions_read_anon ON public.promotions;
CREATE POLICY promotions_read_anon ON public.promotions
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS promotions_auth_all ON public.promotions;
CREATE POLICY promotions_auth_all ON public.promotions
  FOR ALL TO authenticated USING (public.is_admin());

-- Product availability: anon le (cardapio), apenas admins escrevem
CREATE TABLE IF NOT EXISTS public.product_availability (
  product_id INTEGER PRIMARY KEY,
  available  BOOLEAN     NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.product_availability ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_availability_read_anon ON public.product_availability;
CREATE POLICY product_availability_read_anon ON public.product_availability
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS product_availability_auth_all ON public.product_availability;
CREATE POLICY product_availability_auth_all ON public.product_availability
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ─────────────────────────────────────────────
-- 10. REPLICAÇÃO REALTIME
-- ─────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

-- Garante que a tabela orders esteja na replicação realtime sem duplicar erros
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr
    JOIN pg_class c ON c.oid = pr.prrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_publication p ON p.oid = pr.prpubid
    WHERE p.pubname = 'supabase_realtime' 
      AND n.nspname = 'public' 
      AND c.relname = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
END $$;

-- Garante que a tabela product_availability esteja na replicacao realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr
    JOIN pg_class c ON c.oid = pr.prrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_publication p ON p.oid = pr.prpubid
    WHERE p.pubname = 'supabase_realtime'
      AND n.nspname = 'public'
      AND c.relname = 'product_availability'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.product_availability;
  END IF;
END $$;

-- ============================================================
-- FIM DA MIGRATION
-- ============================================================
