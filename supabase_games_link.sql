-- =====================================================================
--  Double Trouble Studios — Pelikortin linkki (valinnainen)
--  Lisää games-tauluun url-sarakkeen. Kun sarakkeessa on osoite,
--  pelikortti näyttää "Play on itch.io" / "Play now" -napin.
--  Turvallista ajaa uudelleen.
-- =====================================================================

alter table public.games add column if not exists url text;

-- Aseta pelin osoite (vaihda oma osoite ja pelin nimi):
-- update public.games
--    set url = 'https://SINUN-TILI.itch.io/mistaken-alien'
--  where title = 'Mistaken Alien';
