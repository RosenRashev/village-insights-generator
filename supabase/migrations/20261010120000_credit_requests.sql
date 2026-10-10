-- Заявки на потребителите за още доклади (кредити). Админът ги одобрява от /admin.
-- Записът става само през сървъра (service role); потребителят може да чете своите заявки.
create table if not exists public.credit_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount int not null check (amount between 1 and 20),
  note text check (note is null or char_length(note) <= 300),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- Най-много една чакаща заявка на потребител.
create unique index if not exists credit_requests_one_pending
  on public.credit_requests (user_id) where status = 'pending';

alter table public.credit_requests enable row level security;

drop policy if exists "own credit requests readable" on public.credit_requests;
create policy "own credit requests readable" on public.credit_requests
  for select to authenticated using (user_id = auth.uid());

revoke all on public.credit_requests from anon, authenticated;
grant select on public.credit_requests to authenticated;
