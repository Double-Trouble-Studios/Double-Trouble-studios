# Double Trouble Studios

Studion kotisivu: <https://double-trouble-studios.github.io/Double-Trouble-studios/>

Staattinen sivusto (HTML, CSS, JS), jonka julkaisee GitHub Pages `main`-haarasta.
Taustana on Supabase (tietokanta ja funktiot), Make.com (sähköpostiautomaatio) ja Gmail (lähetys).
Sivu on kaksikielinen (englanti ja suomi). Kielen vaihtaa nav-palkin FI/EN-napista.

## Tiedostot

| Tiedosto | Tehtävä |
|---|---|
| `index.html` | Etusivu: pelit, tietoa, tiekartta, devlog, press kit, UKK, liittyminen |
| `contact.html` | Yhteydenotto (lomake avaa sähköpostiohjelman) |
| `privacy.html` | Tietosuojaseloste |
| `confirm.html` | Linkkien kohde: sähköpostin vahvistus, kirjautuminen, tilauksen peruutus |
| `404.html` | Virhesivu |
| `style.css` | Koko ulkoasu |
| `nav.js` | Kaikilla sivuilla: kielenvaihto, mobiilivalikko, edistymispalkki, takaisin ylös, jako |
| `script.js` | Etusivun logiikka: pelit, jäsenyys, lomakkeet, devlog |
| `.github/workflows/keepalive.yml` | Pingaa Supabasea 3 päivän välein, ettei ilmaisprojekti pausetu |

## Supabase: SQL ajettavaksi tässä järjestyksessä

Supabase → SQL Editor → New query → liitä tiedosto → Run. Kaikki ovat turvallisia ajaa uudelleen.

1. `supabase_setup.sql` perustaulut (`games`, `subscribers`, `app_settings`)
2. `supabase_members_migration.sql` jäsenyys ja magic link
3. `supabase_devlog.sql` devlog-taulu
4. `supabase_devlog_members_only.sql` devlog vain jäsenille
5. `supabase_member_count.sql` jäsenlaskuri
6. `supabase_devlog_teaser.sql` (valinnainen) vierailijat näkevät uusimpien postausten otsikot
7. `supabase_games_link.sql` (valinnainen) pelikortin "Play"-linkki

Sivun `script.js` ja `confirm.html` sisältävät projektin osoitteen ja julkisen anon-avaimen. Avain on tarkoitettu julkiseksi, mutta jos vaihdat projektia, päivitä molemmat.

## Make.com

Kaksi erillistä skenaariota, kummassakin Custom webhook:

- **Jäsenyys:** webhook → Router, kolme haaraa ehdolla `event` = `subscribed`, `confirmed` tai `login`. Jokaisessa Gmail-viesti. Webhookin osoite menee Supabaseen: `update app_settings set value = '...' where key = 'make_webhook_url';`
- **Uutiskirje:** webhook → Iterator (`recipients`) → Gmail. Osoite avaimeen `make_newsletter_webhook_url`. Lähetys: aseta devlog-postaukselle `send_newsletter = true`.

## Sisällön lisääminen

Supabase → Table Editor:

- **Peli:** `games` → Insert row (`title`, `description`, `image_url`, halutessasi `url`).
- **Devlog-postaus:** `devlog_posts` → Insert row (`title`, `body`). Aseta `send_newsletter = true`, jos haluat sen myös sähköpostina.
- **Rivin poisto:** `active_subscribers` on näkymä eikä siitä voi poistaa. Poista rivi taulusta `subscribers`.

## Kielet

Englanti on sivun oletus ja suomi korvaa sen, kun selaimen kieli on suomi tai kun käyttäjä painaa kielinappia. Käännökset ovat HTML-elementeissä `data-fi`-attribuutteina ja skriptien viesteissä `tr("English", "Suomi")`-kutsuina. Uuden tekstin lisäys: kirjoita englanti elementtiin ja suomi `data-fi`-attribuuttiin.

## Pääsiäismunat

Kirjoita sivulla `trouble`, tai syötä Konami-koodi (↑ ↑ ↓ ↓ ← → ← → B A).
