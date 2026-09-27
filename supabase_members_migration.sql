-- =====================================================================
--  Double Trouble Studios — Jäsenyys/kirjautuminen (magic link)
--  Aja TÄMÄ Supabasen SQL Editorissa perusasennuksen (supabase_setup.sql)
--  PÄÄLLE. Se laajentaa subscribers-taulua, ei poista mitään.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Uudet sarakkeet: kirjautumislinkki + pysyvä "muista minut" -sessio
-- ---------------------------------------------------------------------
alter table public.subscribers
  add column if not exists login_token         uuid not null default gen_random_uuid(),
  add column if not exists login_token_created_at timestamptz not null default now(),
  add column if not exists session_token        uuid not null default gen_random_uuid(),
  add column if not exists last_login_at        timestamptz;

-- Selain ei enää tarvitse suoraa insert-oikeutta — kaikki kirjoitukset
-- kulkevat nyt funktioiden kautta. Tiukennetaan.
revoke insert on public.subscribers from anon, authenticated;

drop policy if exists "Anyone can subscribe" on public.subscribers;


-- ---------------------------------------------------------------------
-- 2) request_access — YKSI funktio sekä tilaukselle että kirjautumiselle
--    Uusi sähköposti  -> luo rivin, lähettää vahvistus/magic-linkin.
--    Vahvistettu vanha -> lähettää uuden kirjautumislinkin.
--    Vahvistamaton vanha -> lähettää vahvistuslinkin uudelleen.
-- ---------------------------------------------------------------------
create or replace function public.request_access(email_input text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email  text := lower(trim(email_input));
  v_row    public.subscribers;
begin
  if v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return;
  end if;

  select * into v_row from public.subscribers where lower(email) = v_email;

  if not found then
    insert into public.subscribers (email) values (v_email);
    return;
  end if;

  if v_row.unsubscribed_at is not null then
    update public.subscribers
       set unsubscribed_at = null
     where id = v_row.id;
  end if;

  if v_row.confirmed then
    update public.subscribers
       set login_token = gen_random_uuid(),
           login_token_created_at = now()
     where id = v_row.id;
  else
    update public.subscribers
       set confirm_token = gen_random_uuid()
     where id = v_row.id;
  end if;
end;
$$;

revoke all on function public.request_access(text) from public;
grant execute on function public.request_access(text) to anon, authenticated;


-- ---------------------------------------------------------------------
-- 3) verify_magic_link — landing-sivun (confirm.html) käyttämä funktio.
--    Tunnistaa itse onko token ensivahvistus vai paluukirjautuminen.
--    Palauttaa aina JSONin, ei koskaan pelkkää boolean-arvoa.
-- ---------------------------------------------------------------------
create or replace function public.verify_magic_link(token_input text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token uuid;
  v_row   public.subscribers;
begin
  begin
    v_token := token_input::uuid;
  exception when others then
    return json_build_object('ok', false, 'reason', 'invalid');
  end;

  -- Tapaus A: ensimmäinen vahvistuslinkki (7 vrk voimassa)
  select * into v_row from public.subscribers
   where confirm_token = v_token
     and confirmed = false
     and unsubscribed_at is null
     and created_at > now() - interval '7 days';

  if found then
    update public.subscribers
       set confirmed      = true,
           confirmed_at   = now(),
           confirm_token  = gen_random_uuid(),
           session_token  = gen_random_uuid(),
           last_login_at  = now()
     where id = v_row.id
     returning * into v_row;

    return json_build_object(
      'ok', true, 'welcome', true,
      'email', v_row.email, 'session_token', v_row.session_token
    );
  end if;

  -- Tapaus B: paluukirjautumisen magic link (1 h voimassa)
  select * into v_row from public.subscribers
   where login_token = v_token
     and confirmed = true
     and unsubscribed_at is null
     and login_token_created_at > now() - interval '1 hour';

  if found then
    update public.subscribers
       set login_token   = gen_random_uuid(),
           session_token = gen_random_uuid(),
           last_login_at = now()
     where id = v_row.id
     returning * into v_row;

    return json_build_object(
      'ok', true, 'welcome', false,
      'email', v_row.email, 'session_token', v_row.session_token
    );
  end if;

  return json_build_object('ok', false, 'reason', 'expired');
end;
$$;

revoke all on function public.verify_magic_link(text) from public;
grant execute on function public.verify_magic_link(text) to anon, authenticated;


-- ---------------------------------------------------------------------
-- 4) get_member — sivun lataus kysyy tällä "kuka olet" localStorageen
--    tallennetulla session-tokenilla (90 vrk voimassa).
-- ---------------------------------------------------------------------
create or replace function public.get_member(session_token_input text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token uuid;
  v_row   public.subscribers;
begin
  begin
    v_token := session_token_input::uuid;
  exception when others then
    return json_build_object('ok', false);
  end;

  select * into v_row from public.subscribers
   where session_token = v_token
     and confirmed = true
     and unsubscribed_at is null
     and last_login_at > now() - interval '90 days';

  if not found then
    return json_build_object('ok', false);
  end if;

  return json_build_object('ok', true, 'email', v_row.email);
end;
$$;

revoke all on function public.get_member(text) from public;
grant execute on function public.get_member(text) to anon, authenticated;


-- ---------------------------------------------------------------------
-- 5) unsubscribe — päivitetty niin että se myös kirjaa ulos kaikkialta
-- ---------------------------------------------------------------------
create or replace function public.unsubscribe(token_input text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token uuid;
  v_rows  int;
begin
  begin
    v_token := token_input::uuid;
  exception when others then
    return false;
  end;

  update public.subscribers
     set unsubscribed_at = now(),
         session_token    = gen_random_uuid()   -- vanhat "kirjautumiset" mitätöityvät
   where unsubscribe_token = v_token
     and unsubscribed_at is null;

  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$$;


-- ---------------------------------------------------------------------
-- 6) notify_make — nyt kolme tapahtumaa Makelle:
--    'subscribed' (uusi tilaus / vahvistuksen uudelleenlähetys)
--    'confirmed'  (ensimmäinen vahvistus, tervetuloviesti)
--    'login'      (palaavan jäsenen kirjautumislinkki)
-- ---------------------------------------------------------------------
create or replace function public.notify_make()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hook  text;
  v_site  text;
  v_event text;
begin
  select value into v_hook from public.app_settings where key = 'make_webhook_url';
  select value into v_site from public.app_settings where key = 'site_url';

  if coalesce(v_hook, '') = '' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_event := 'subscribed';
  elsif tg_op = 'UPDATE' and new.confirmed and not old.confirmed then
    v_event := 'confirmed';
  elsif tg_op = 'UPDATE' and not new.confirmed
        and new.confirm_token is distinct from old.confirm_token then
    v_event := 'subscribed';            -- vahvistuslinkin uudelleenlähetys
  elsif tg_op = 'UPDATE' and new.confirmed
        and new.login_token is distinct from old.login_token then
    v_event := 'login';                 -- paluukirjautuminen
  else
    return new;
  end if;

  perform net.http_post(
    url     := v_hook,
    body    := jsonb_build_object(
                 'event',           v_event,
                 'email',           new.email,
                 'confirm_url',     v_site || '/confirm.html?token=' || new.confirm_token,
                 'login_url',       v_site || '/confirm.html?token=' || new.login_token,
                 'unsubscribe_url', v_site || '/confirm.html?unsub=' || new.unsubscribe_token,
                 'created_at',      new.created_at
               ),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );

  return new;
end;
$$;

drop trigger if exists trg_subscribers_notify_make on public.subscribers;
create trigger trg_subscribers_notify_make
  after insert or update of confirmed, confirm_token, login_token
  on public.subscribers
  for each row execute function public.notify_make();

-- =====================================================================
--  VALMIS ✅  Seuraavaksi: aja tämä SQL, sitten lisää Makeen 3. haara
--  Routeriin, ehto  event = login , Gmail-viesti jossa linkki {{1.login_url}}
-- =====================================================================
