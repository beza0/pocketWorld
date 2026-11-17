-- Pocket World / Dünya Cepte: account progress.
-- Every row belongs to exactly one user; row level security makes other users' rows invisible.

create table if not exists public.discoveries (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  country_id text not null check (country_id ~ '^[a-z]{2}$'),
  discovered boolean not null,
  updated_at timestamptz not null,
  primary key (user_id, country_id)
);

create table if not exists public.daily_results (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('quiz', 'mystery')),
  day date not null,
  score smallint not null check (score >= 0),
  max_score smallint not null check (max_score > 0 and score <= max_score),
  detail jsonb not null default '[]'::jsonb,
  completed_at timestamptz not null,
  device_id text not null check (char_length(device_id) between 1 and 64),
  primary key (user_id, kind, day)
);

alter table public.discoveries enable row level security;
alter table public.daily_results enable row level security;

create policy "own discoveries: select" on public.discoveries for select to authenticated using ((select auth.uid()) = user_id);
create policy "own discoveries: insert" on public.discoveries for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own discoveries: update" on public.discoveries for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "own results: select" on public.daily_results for select to authenticated using ((select auth.uid()) = user_id);
create policy "own results: insert" on public.daily_results for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own results: update" on public.daily_results for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on public.discoveries, public.daily_results from anon;

-- Idempotent upsert with the same conflict rules as the client (src/core/progress.ts):
--   discoveries:   last write wins; on equal timestamps "discovered = true" wins
--   daily_results: the FIRST completed result wins; ties → smaller device_id, then higher score
-- Runs with the caller's rights (security invoker), so RLS still applies.
create or replace function public.push_progress(p_discoveries jsonb, p_results jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated';
  end if;

  insert into public.discoveries as d (user_id, country_id, discovered, updated_at)
  select (select auth.uid()), x.country_id, x.discovered, x.updated_at
  from jsonb_to_recordset(coalesce(p_discoveries, '[]'::jsonb)) as x(country_id text, discovered boolean, updated_at timestamptz)
  on conflict (user_id, country_id) do update
    set discovered = excluded.discovered, updated_at = excluded.updated_at
    where excluded.updated_at > d.updated_at
       or (excluded.updated_at = d.updated_at and excluded.discovered and not d.discovered);

  insert into public.daily_results as r (user_id, kind, day, score, max_score, detail, completed_at, device_id)
  select (select auth.uid()), x.kind, x.day, x.score, x.max_score, coalesce(x.detail, '[]'::jsonb), x.completed_at, x.device_id
  from jsonb_to_recordset(coalesce(p_results, '[]'::jsonb))
    as x(kind text, day date, score smallint, max_score smallint, detail jsonb, completed_at timestamptz, device_id text)
  on conflict (user_id, kind, day) do update
    set score = excluded.score, max_score = excluded.max_score, detail = excluded.detail,
        completed_at = excluded.completed_at, device_id = excluded.device_id
    where excluded.completed_at < r.completed_at
       or (excluded.completed_at = r.completed_at and excluded.device_id < r.device_id)
       or (excluded.completed_at = r.completed_at and excluded.device_id = r.device_id and excluded.score > r.score);
end;
$$;

revoke all on function public.push_progress(jsonb, jsonb) from public, anon;
grant execute on function public.push_progress(jsonb, jsonb) to authenticated;
