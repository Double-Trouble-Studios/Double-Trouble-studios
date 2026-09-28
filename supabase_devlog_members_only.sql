-- =====================================================================
--  Devlog vain kirjautuneille jäsenille
--  Aja Supabasen SQL Editorissa. Turvallista ajaa uudelleen.
--  Sulkee julkisen lukuoikeuden ja avaa lukemisen vain get_devlog()-
--  funktion kautta, joka tarkistaa jäsenen session-tokenin.
-- =====================================================================

drop policy if exists "Public can read published devlog" on public.devlog_posts;
revoke select on public.devlog_posts from anon, authenticated;

create or replace function public.get_devlog(session_token_input text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token uuid;
  v_ok    boolean;
begin
  begin
    v_token := session_token_input::uuid;
  exception when others then
    return json_build_object('ok', false);
  end;

  select exists (
    select 1 from public.subscribers
     where session_token = v_token
       and confirmed = true
       and unsubscribed_at is null
       and last_login_at > now() - interval '90 days'
  ) into v_ok;

  if not v_ok then
    return json_build_object('ok', false);
  end if;

  return json_build_object(
    'ok', true,
    'posts', coalesce((
      select json_agg(p order by p.published_at desc)
        from (
          select id, title, body, published_at
            from public.devlog_posts
           where published = true
           order by published_at desc
           limit 10
        ) p
    ), '[]'::json)
  );
end;
$$;

revoke all on function public.get_devlog(text) from public;
grant execute on function public.get_devlog(text) to anon, authenticated;
