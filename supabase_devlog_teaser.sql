-- =====================================================================
--  Double Trouble Studios — Devlog-esimaku vierailijoille (valinnainen)
--  Palauttaa vain kolmen uusimman julkaistun postauksen OTSIKON ja päivän.
--  Sisältö (body) pysyy jäsenille. Turvallista ajaa uudelleen.
-- =====================================================================

create or replace function public.get_devlog_teaser()
returns json
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(json_agg(p), '[]'::json)
    from (
      select title, published_at
        from public.devlog_posts
       where published = true
       order by published_at desc
       limit 3
    ) p;
$$;

revoke all on function public.get_devlog_teaser() from public;
grant execute on function public.get_devlog_teaser() to anon, authenticated;
