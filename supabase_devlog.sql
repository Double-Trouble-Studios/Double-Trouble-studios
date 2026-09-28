-- =====================================================================
--  Double Trouble Studios — Devlog
--  Aja Supabasen SQL Editorissa. Turvallista ajaa uudelleen.
-- =====================================================================

create table if not exists public.devlog_posts (
  id           bigint generated always as identity primary key,
  title        text not null,
  body         text not null,
  published    boolean not null default true,
  published_at timestamptz not null default now()
);

alter table public.devlog_posts enable row level security;

revoke all on public.devlog_posts from anon, authenticated;
grant select on public.devlog_posts to anon, authenticated;

drop policy if exists "Public can read published devlog" on public.devlog_posts;
create policy "Public can read published devlog"
  on public.devlog_posts for select
  to anon, authenticated
  using (published = true);

-- Uusi postaus: Supabase → Table Editor → devlog_posts → Insert row,
-- tai SQL:llä:
-- insert into public.devlog_posts (title, body) values
--   ('Devlog #1', 'Ensimmäinen postaus. Rivinvaihdot säilyvät.');
