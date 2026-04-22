-- =============================================================
-- Row-Level Security Policies
-- =============================================================
-- Run this AFTER 001_initial_schema.sql
--
-- Model:
--   - Admin API routes use the SERVICE_ROLE key → bypass RLS entirely
--   - Public /m/[token] endpoint fetches via token in a server action
--     that uses SERVICE_ROLE but scopes by access_token
--   - We still enable RLS on every table as defense-in-depth
--   - No direct browser → Supabase access; everything goes through Next.js API
-- =============================================================

alter table admins                  enable row level security;
alter table publications            enable row level security;
alter table members                 enable row level security;
alter table subscriptions           enable row level security;
alter table books                   enable row level security;
alter table orders                  enable row level security;
alter table order_items             enable row level security;
alter table payments                enable row level security;
alter table address_change_requests enable row level security;
alter table audit_log               enable row level security;

-- Default deny — no anon/authenticated user can touch these tables.
-- Service role bypasses RLS by design.
-- Admins authenticate via Supabase Auth and we verify server-side
-- in API routes before using service role to query.

-- Published books can be read by anyone (catalogue is public)
create policy "books_public_read"
  on books for select
  using (is_published = true and is_out_of_print = false);

-- All other tables: no direct client access at all.
-- Empty policy list + RLS enabled = default deny.

-- =============================================================
-- Helper view: members_with_subscription_status
-- Convenience view used by the mailing-list generator.
-- =============================================================
create or replace view members_with_sub_status
with (security_invoker = on) as
select
  m.*,
  s.id as current_subscription_id,
  s.type as current_subscription_type,
  s.end_date as current_subscription_end,
  case
    when s.id is null then 'no_subscription'
    when s.type = 'life_member' then 'life_active'
    when s.status = 'active' and s.end_date >= current_date then 'annual_active'
    when s.status = 'active' and s.end_date < current_date then 'annual_expired'
    else s.status::text
  end as effective_status
from members m
left join lateral (
  select *
  from subscriptions
  where member_id = m.id
    and status = 'active'
  order by
    case when end_date is null then 1 else 0 end desc, -- life members first
    end_date desc nulls first
  limit 1
) s on true;
