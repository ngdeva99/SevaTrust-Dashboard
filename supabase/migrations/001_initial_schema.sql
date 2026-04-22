-- =============================================================
-- Trust Management System - Initial Schema
-- =============================================================
-- Run this AFTER creating your Supabase project.
-- Execute in: Supabase Dashboard → SQL Editor → New Query
-- =============================================================

-- Extensions (pgcrypto is enabled by default on Supabase)
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm"; -- for fuzzy search on names

-- =============================================================
-- Enums
-- =============================================================
create type member_title as enum ('SRI', 'SMT', 'MS', 'DR', 'OTHER');
create type member_status as enum ('active', 'paused', 'deceased', 'cancelled', 'book_only');
create type subscription_type as enum ('life_member', 'annual');
create type subscription_status as enum ('active', 'expired', 'cancelled');
create type payment_method as enum ('razorpay', 'cheque', 'cash', 'upi_manual', 'bank_transfer', 'historical');
create type payment_purpose as enum ('subscription', 'book_order', 'donation');
create type order_status as enum ('pending_payment', 'paid', 'shipped', 'delivered', 'cancelled');
create type language_code as enum ('TAMIL', 'TELUGU', 'ENGLISH', 'SANSKRIT', 'KANNADA', 'HINDI');
create type admin_role as enum ('super_admin', 'editor', 'viewer');
create type address_change_status as enum ('pending', 'approved', 'rejected');

-- =============================================================
-- admins - maps Supabase auth users to roles
-- =============================================================
create table admins (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  phone text,
  role admin_role not null default 'editor',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

create index idx_admins_email on admins(email);

-- =============================================================
-- publications - extensible for future magazines/languages
-- =============================================================
create table publications (
  id uuid primary key default gen_random_uuid(),
  code text not null unique, -- e.g. 'MAIN_MAGAZINE', 'TAMIL_DIARY'
  name text not null,
  description text,
  language language_code,
  is_active boolean not null default true,
  annual_price_inr integer not null, -- price in paise (₹500 = 50000)
  life_member_price_inr integer not null,
  created_at timestamptz not null default now()
);

-- Seed one default publication. You can rename this later from the admin UI.
insert into publications (code, name, annual_price_inr, life_member_price_inr)
values ('MAIN', 'Main Magazine', 50000, 500000);

-- =============================================================
-- members - the heart of the system
-- =============================================================
create table members (
  id uuid primary key default gen_random_uuid(),
  member_code text not null unique, -- 'LM-0001', 'AS-0342'
  access_token text not null unique, -- for /m/[token] status page

  -- Identity
  title member_title not null default 'SRI',
  full_name text not null,

  -- Contact
  phone text,
  email text,

  -- Address (free-form to match messy legacy data)
  address_line1 text,
  address_line2 text,
  address_line3 text,
  city text,
  state text,
  country text default 'India',
  pin_code text,

  -- Preferences
  default_language language_code,
  diary_copies integer not null default 1,

  -- PAN (encrypted via app-level encryption before INSERT)
  -- Stored as bytea, never as plaintext. See src/lib/crypto/pan.ts.
  pan_encrypted bytea,
  pan_last4 text, -- plaintext last 4 chars for display/search only

  -- Notes
  internal_notes text default '',

  -- State
  status member_status not null default 'active',

  -- Migration bookkeeping
  legacy_raw_text text, -- original text from the .doc file, for audit
  legacy_import_id text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_members_code on members(member_code);
create index idx_members_access_token on members(access_token);
create index idx_members_name_trgm on members using gin (full_name gin_trgm_ops);
create index idx_members_phone on members(phone);
create index idx_members_pin on members(pin_code);
create index idx_members_city on members(city);
create index idx_members_status on members(status);
create index idx_members_notes_trgm on members using gin (internal_notes gin_trgm_ops);

-- Auto-update updated_at
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_members_updated_at
  before update on members
  for each row execute function set_updated_at();

-- =============================================================
-- subscriptions - one row per subscription period
-- =============================================================
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  publication_id uuid not null references publications(id),

  type subscription_type not null,
  start_date date not null,
  end_date date, -- null = life member, never expires
  years_paid integer not null default 1,
  amount_paid_inr integer not null, -- in paise
  status subscription_status not null default 'active',
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now()
);

create index idx_subs_member on subscriptions(member_id);
create index idx_subs_publication on subscriptions(publication_id);
create index idx_subs_status on subscriptions(status);
create index idx_subs_end_date on subscriptions(end_date);

-- =============================================================
-- books - catalogue
-- =============================================================
create table books (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  author text,
  description text,
  language language_code,
  cover_image_url text,
  price_inr integer not null, -- in paise
  stock_count integer, -- null = not tracked
  is_published boolean not null default false,
  is_out_of_print boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_books_updated_at
  before update on books
  for each row execute function set_updated_at();

-- =============================================================
-- orders - book purchases
-- =============================================================
create table orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique, -- 'ORD-2026-00123'
  member_id uuid references members(id), -- nullable for guest checkout

  -- Snapshot at order time (don't reference members.address -- may change later)
  shipping_name text not null,
  shipping_phone text,
  shipping_email text,
  shipping_address_line1 text not null,
  shipping_address_line2 text,
  shipping_address_line3 text,
  shipping_city text not null,
  shipping_state text,
  shipping_country text default 'India',
  shipping_pin_code text not null,

  status order_status not null default 'pending_payment',
  total_amount_inr integer not null,
  tracking_number text,
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_orders_member on orders(member_id);
create index idx_orders_status on orders(status);
create index idx_orders_code on orders(order_code);

create trigger trg_orders_updated_at
  before update on orders
  for each row execute function set_updated_at();

-- =============================================================
-- order_items
-- =============================================================
create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  book_id uuid not null references books(id),
  quantity integer not null default 1,
  unit_price_inr integer not null -- frozen at purchase time
);

create index idx_order_items_order on order_items(order_id);

-- =============================================================
-- payments - ALL payments, online or offline
-- =============================================================
create table payments (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references members(id),
  amount_inr integer not null, -- in paise
  method payment_method not null,
  reference text, -- razorpay_payment_id, cheque number, UPI txn id, etc.
  purpose payment_purpose not null,
  subscription_id uuid references subscriptions(id),
  order_id uuid references orders(id),
  received_at timestamptz not null,
  recorded_by_admin_id uuid references admins(id),
  receipt_number text unique, -- auto-generated, see trigger below
  financial_year text, -- '2025-26' for Indian FY
  notes text,
  razorpay_order_id text,
  razorpay_signature text,
  created_at timestamptz not null default now()
);

create index idx_payments_member on payments(member_id);
create index idx_payments_received on payments(received_at);
create index idx_payments_method on payments(method);
create index idx_payments_fy on payments(financial_year);

-- =============================================================
-- address_change_requests - members request via /m/[token]
-- =============================================================
create table address_change_requests (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  new_address_line1 text,
  new_address_line2 text,
  new_address_line3 text,
  new_city text,
  new_state text,
  new_pin_code text,
  new_phone text,
  requested_at timestamptz not null default now(),
  status address_change_status not null default 'pending',
  reviewed_by_admin_id uuid references admins(id),
  reviewed_at timestamptz,
  admin_notes text
);

create index idx_acr_member on address_change_requests(member_id);
create index idx_acr_status on address_change_requests(status);

-- =============================================================
-- audit_log - every significant admin action
-- =============================================================
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references admins(id),
  action text not null, -- 'create_member', 'update_address', 'record_payment', etc.
  entity_type text not null, -- 'member', 'payment', 'subscription', etc.
  entity_id uuid,
  before_json jsonb,
  after_json jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index idx_audit_admin on audit_log(admin_id);
create index idx_audit_entity on audit_log(entity_type, entity_id);
create index idx_audit_created on audit_log(created_at desc);

-- =============================================================
-- sequences for human-readable codes
-- =============================================================
create sequence member_life_seq start 1;
create sequence member_annual_seq start 1;
create sequence order_seq start 1;
create sequence receipt_seq start 1;

-- =============================================================
-- helper: financial year for a date
-- (Indian FY runs April -> March)
-- =============================================================
create or replace function indian_fy(d date) returns text as $$
declare
  y int;
begin
  if extract(month from d) >= 4 then
    y := extract(year from d);
  else
    y := extract(year from d) - 1;
  end if;
  return y || '-' || lpad(((y + 1) % 100)::text, 2, '0');
end;
$$ language plpgsql immutable;

-- auto-fill financial_year on payments
create or replace function fill_payment_fy() returns trigger as $$
begin
  if new.financial_year is null then
    new.financial_year := indian_fy(new.received_at::date);
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_payments_fy
  before insert on payments
  for each row execute function fill_payment_fy();
