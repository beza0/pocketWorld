-- In-app account deletion (required by the App Store and Google Play when sign-in is offered).
-- Deletes the caller's auth user; discoveries and daily_results go with it (on delete cascade).
-- security definer is needed to touch auth.users; the function can only ever delete auth.uid().
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  delete from public.discoveries where user_id = uid;
  delete from public.daily_results where user_id = uid;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
