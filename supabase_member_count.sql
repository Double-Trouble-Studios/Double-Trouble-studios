-- =====================================================================
--  Double Trouble Studios — Julkinen jäsenlaskuri
--  Aja Supabasen SQL Editorissa. Turvallista ajaa uudelleen.
--  Palauttaa vain lukumäärän, ei sähköposteja eikä muuta tietoa.
-- =====================================================================

create or replace function public.get_member_count()
returns json
language sql
security definer
set search_path = public
stable
as $$
  select json_build_object(
    'count', (
      select count(*) from public.subscribers
       where confirmed = true and unsubscribed_at is null
    )
  );
$$;

revoke all on function public.get_member_count() from public;
grant execute on function public.get_member_count() to anon, authenticated;
