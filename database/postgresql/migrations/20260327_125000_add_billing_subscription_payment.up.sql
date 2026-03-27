DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SubscriptionStatus') THEN
    CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BillingPeriod') THEN
    CREATE TYPE "BillingPeriod" AS ENUM ('MONTHLY', 'YEARLY');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentStatus') THEN
    CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'CANCELED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  status "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
  billing_period "BillingPeriod" NOT NULL DEFAULT 'MONTHLY',
  amount NUMERIC(10, 2) NOT NULL,
  currency_code CHAR(3) NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,
  provider VARCHAR(40),
  provider_customer_id VARCHAR(120),
  provider_subscription_id VARCHAR(120),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT subscriptions_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES public.users(id)
    ON DELETE CASCADE,
  CONSTRAINT subscriptions_amount_positive_check
    CHECK (amount >= 0),
  CONSTRAINT subscriptions_period_order_check
    CHECK (current_period_end >= current_period_start)
);

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  subscription_id UUID,
  status "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  amount NUMERIC(10, 2) NOT NULL,
  currency_code CHAR(3) NOT NULL,
  provider VARCHAR(40),
  provider_payment_id VARCHAR(120),
  provider_invoice_id VARCHAR(120),
  paid_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason VARCHAR(255),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT payments_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES public.users(id)
    ON DELETE CASCADE,
  CONSTRAINT payments_subscription_id_fkey
    FOREIGN KEY (subscription_id)
    REFERENCES public.subscriptions(id)
    ON DELETE SET NULL,
  CONSTRAINT payments_amount_positive_check
    CHECK (amount >= 0)
);

CREATE INDEX IF NOT EXISTS subscriptions_user_id_status_current_period_end_idx
  ON public.subscriptions (user_id, status, current_period_end);

CREATE INDEX IF NOT EXISTS subscriptions_provider_provider_subscription_id_idx
  ON public.subscriptions (provider, provider_subscription_id);

CREATE INDEX IF NOT EXISTS payments_user_id_status_created_at_idx
  ON public.payments (user_id, status, created_at);

CREATE INDEX IF NOT EXISTS payments_subscription_id_created_at_idx
  ON public.payments (subscription_id, created_at);

CREATE INDEX IF NOT EXISTS payments_provider_provider_payment_id_idx
  ON public.payments (provider, provider_payment_id);
