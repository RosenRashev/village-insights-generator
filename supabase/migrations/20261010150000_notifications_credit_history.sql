-- Известия (камбанката в хедъра) и история на докладите (кредитите).
-- Записът е само през сървъра (service role); потребителят чете само своите редове.
-- Скриптът е идемпотентен — може да се пусне и ако `credit_requests` вече е създадена.

-- 1) Заявки за доклади (същото като 20261010120000_credit_requests.sql)
create table if not exists public.credit_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount int not null check (amount between 1 and 20),
  note text check (note is null or char_length(note) <= 300),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create unique index if not exists credit_requests_one_pending
  on public.credit_requests (user_id) where status = 'pending';
alter table public.credit_requests enable row level security;
drop policy if exists "own credit requests readable" on public.credit_requests;
create policy "own credit requests readable" on public.credit_requests
  for select to authenticated using (user_id = auth.uid());
revoke all on public.credit_requests from anon, authenticated;
grant select on public.credit_requests to authenticated;

-- 2) Известия
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  title text not null check (char_length(title) <= 200),
  body text check (body is null or char_length(body) <= 500),
  link text check (link is null or char_length(link) <= 300),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_created
  on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
drop policy if exists "own notifications readable" on public.notifications;
create policy "own notifications readable" on public.notifications
  for select to authenticated using (user_id = auth.uid());
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;

-- 3) История на кредитите (всяка промяна на баланса)
create table if not exists public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  delta int not null,
  balance_after int,
  reason text not null check (reason in ('admin', 'request', 'report', 'refund', 'welcome')),
  note text check (note is null or char_length(note) <= 300),
  place text check (place is null or char_length(place) <= 300),
  actor_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists credit_transactions_user_created
  on public.credit_transactions (user_id, created_at desc);
alter table public.credit_transactions enable row level security;
drop policy if exists "own credit history readable" on public.credit_transactions;
create policy "own credit history readable" on public.credit_transactions
  for select to authenticated using (user_id = auth.uid());
revoke all on public.credit_transactions from anon, authenticated;
grant select on public.credit_transactions to authenticated;

-- Supabase API да види новите таблици веднага.
notify pgrst, 'reload schema';
