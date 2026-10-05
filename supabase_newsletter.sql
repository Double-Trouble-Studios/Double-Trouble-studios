-- =====================================================================
--  Double Trouble Studios — Devlog-uutiskirje (Make.com)
--  Aja Supabasen SQL Editorissa. Turvallista ajaa uudelleen.
--  Kun devlog-postaukselle asetetaan send_newsletter = true ja
--  published = true, postaus lähetetään kerran Makelle yhdessä kaikkien
--  vahvistettujen tilaajien kanssa. Make lähettää sähköpostit.
-- =====================================================================

create extension if not exists pg_net;

alter table public.devlog_posts
  add column if not exists send_newsletter    boolean not null default false,
  add column if not exists newsletter_sent_at timestamptz;

insert into public.app_settings (key, value) values
  ('make_newsletter_webhook_url', '')
on conflict (key) do nothing;

create or replace function public.send_devlog_newsletter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hook       text;
  v_site       text;
  v_recipients jsonb;
  v_html       text;
begin
  if not (new.send_newsletter and new.published and new.newsletter_sent_at is null) then
    return new;
  end if;

  select value into v_hook from public.app_settings where key = 'make_newsletter_webhook_url';
  select value into v_site from public.app_settings where key = 'site_url';

  -- Ei webhookia asetettu: jätetään lähettämättä, voi yrittää uudelleen
  if coalesce(v_hook, '') = '' then
    return new;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'email',           s.email,
           'unsubscribe_url', v_site || '/confirm.html?unsub=' || s.unsubscribe_token
         )), '[]'::jsonb)
    into v_recipients
    from public.subscribers s
   where s.confirmed and s.unsubscribed_at is null;

  v_html := replace(replace(replace(replace(new.body, '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), E'\n', '<br>');

  perform net.http_post(
    url     := v_hook,
    body    := jsonb_build_object(
                 'event',      'newsletter',
                 'title',      new.title,
                 'body_html',  v_html,
                 'post_url',   v_site || '/index.html#devlog',
                 'recipients', v_recipients
               ),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );

  new.newsletter_sent_at := now();
  return new;
end;
$$;

drop trigger if exists trg_devlog_newsletter on public.devlog_posts;
create trigger trg_devlog_newsletter
  before insert or update of send_newsletter, published
  on public.devlog_posts
  for each row execute function public.send_devlog_newsletter();
