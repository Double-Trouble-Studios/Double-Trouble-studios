-- =====================================================================
--  Double Trouble Studios — Supabase setup (perusasennus)
--  Aja ENSIMMÄISENÄ: Supabase → SQL Editor → New query → Run
--  Skriptin voi ajaa uudelleen turvallisesti (idempotentti).
--  Seuraavaksi: supabase_members_migration.sql (jäsenyys / magic link)
-- =====================================================================

create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists pg_net;     -- HTTP-kutsut Make.comiin


-- 1) ASETUKSET (yksityinen taulu, vain sinä näet sen dashboardissa)
create table if not exists public.app_settings (
  key   text primary key,
  value text not null
);

alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;

insert into public.app_settings (key, value) values
  ('site_url',         'https://double-trouble-studios.github.io/Double-Trouble-studios'),
  ('make_webhook_url', '')
on conflict (key) do nothing;


-- 2) PELIT
create table if not exists public.games (
  id          bigint generated always as identity primary key,
  title       text not null,
  description text,
  image_url   text,
  published   boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.games enable row level security;

revoke all on public.games from anon, authenticated;
grant select on public.games to anon, authenticated;

drop policy if exists "Public can read published games" on public.games;
create policy "Public can read published games"
  on public.games for select
  to anon, authenticated
  using (published = true);


-- 3) TILAAJAT
create table if not exists public.subscribers (
  id                uuid primary key default gen_random_uuid(),
  email             text not null,
  confirm_token     uuid not null default gen_random_uuid(),
  confirmed         boolean not null default false,
  confirmed_at      timestamptz,
  unsubscribe_token uuid not null default gen_random_uuid(),
  unsubscribed_at   timestamptz,
  created_at        timestamptz not null default now(),
  constraint subscribers_email_format check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

create unique index if not exists subscribers_email_unique
  on public.subscribers (lower(email));

alter table public.subscribers enable row level security;
revoke all on public.subscribers from anon, authenticated;

-- Palvelin päättää tokenit ja tilan, ei selain.
create or replace function public.subscribers_before_insert()
returns trigger
language plpgsql
as $$
begin
  new.email             := lower(trim(new.email));
  new.confirm_token     := gen_random_uuid();
  new.unsubscribe_token := gen_random_uuid();
  new.confirmed         := false;
  new.confirmed_at      := null;
  new.unsubscribed_at   := null;
  new.created_at        := now();
  return new;
end;
$$;

drop trigger if exists trg_subscribers_before_insert on public.subscribers;
create trigger trg_subscribers_before_insert
  before insert on public.subscribers
  for each row execute function public.subscribers_before_insert();


-- 4) Näkymä sinulle dashboardiin (ei näy julkisesti)
create or replace view public.active_subscribers
with (security_invoker = true) as
  select email, confirmed_at, created_at
    from public.subscribers
   where confirmed and unsubscribed_at is null
   order by confirmed_at desc;

revoke all on public.active_subscribers from anon, authenticated;

-- HUOM: vahvistus-, kirjautumis- ja Make-webhook-funktiot tulevat
-- tiedostosta supabase_members_migration.sql.
