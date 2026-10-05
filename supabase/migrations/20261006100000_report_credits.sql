-- Кредити за доклади: администраторът определя колко нови доклада може да генерира всеки потребител.
-- Пише се САМО от сървъра (service role) — потребителите могат само да четат собствения си баланс.

create table if not exists public.report_credits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

alter table public.report_credits enable row level security;

drop policy if exists "Users read own credits" on public.report_credits;
create policy "Users read own credits" on public.report_credits
  for select to authenticated using (auth.uid() = user_id);

revoke insert, update, delete on public.report_credits from anon, authenticated;

-- Атомична промяна на баланса. При p_require = true и недостатъчен баланс не променя нищо и връща -1.
create or replace function public.adjust_report_credits(p_user uuid, p_delta integer, p_require boolean default false)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  current_balance integer;
begin
  insert into public.report_credits (user_id, balance) values (p_user, 0)
    on conflict (user_id) do nothing;
  select balance into current_balance from public.report_credits where user_id = p_user for update;
  if p_require and current_balance + p_delta < 0 then
    return -1;
  end if;
  update public.report_credits
    set balance = greatest(0, current_balance + p_delta), updated_at = now()
    where user_id = p_user
    returning balance into current_balance;
  return current_balance;
end;
$$;

revoke all on function public.adjust_report_credits(uuid, integer, boolean) from public, anon, authenticated;
grant execute on function public.adjust_report_credits(uuid, integer, boolean) to service_role;
