# Guida di test — Bug 1, 2, 3

Link app: http://localhost:8082 (server web deve essere avviato: `npx expo start --web --port 8082`)
SQL Editor: https://supabase.com/dashboard/project/ilhwpwfmoobasbnouaim/sql/new

Credenziali:

| Ruolo | Email | Password |
|---|---|---|
| Manager | manager.flow.test@gymly.test | ManagerNuovo123! |
| Coach | coach.showcase@gymly.test | CoachDemo2026! |
| Cliente | client.showcase2@gymly.test | EEYN97RKEX |
| Admin | admin.showcase@gymly.test | AdminDemo2026! |

---

## Bug 1 — Posizione palestra mancante (check-in impossibile)

**Cosa è stato fatto**: aggiunti i campi Latitudine/Longitudine/Raggio nella pagina "Apertura" del Manager e nella scheda palestra dell'Admin, con RPC `manager_set_site_location` / `admin_set_site_location`.

**Come testarlo**:

1. Login come **Manager** → tab "Apertura".
2. Scorri fino a "Posizione palestra". Se è la prima volta, i campi sono vuoti.
3. Premi "Usa la mia posizione" (chiede il permesso GPS del browser) oppure scrivi a mano Latitudine/Longitudine/Raggio (es. 150).
4. Premi "Salva posizione" → deve apparire la conferma, senza bisogno di nessun SQL.
5. Login come **Cliente** (stesso telefono/browser) → tab "Check-in":
   - Se sei a più di "raggio" metri dal punto salvato → messaggio "Sei troppo lontano dalla palestra per fare il check-in."
   - Se sei dentro il raggio → check-in riuscito, il bottone diventa CHECK-OUT con cronometro.
6. (Opzionale, solo Admin) Login come **Admin** → "Palestre" → tocca una palestra → "Posizione palestra" → stessi campi, senza il bottone "usa la mia posizione" (l'Admin gestisce sedi che non sono le sue).

**Controprova SQL** (facoltativa, nell'SQL Editor):
```sql
select name, location is null as manca_posizione, radius from public.sites;
```
Solo le palestre su cui qualcuno ha già premuto "Salva posizione" avranno `manca_posizione = false`. Le altre vanno impostate una volta a testa dal relativo Manager (o dall'Admin).

---

## Bug 2 — Rename persone (migration mancanti + errore silenzioso)

**Cosa è stato fatto**: applicate 2 migration mancanti (`manager_set_person_name`, sistema inviti `invites`); aggiunto un messaggio di errore visibile in `PeopleScreen.tsx` quando il rename fallisce (prima spariva senza dire nulla).

**Come testarlo**:

1. Login come **Manager** → tab "Persone".
2. Su un Coach o Cliente, premi "Modifica nome" → scrivi un nome → "Conferma".
   - Atteso: il form si chiude, il nome nuovo appare subito nella lista (nessun refresh manuale necessario).
3. Vai su "Situazione" (o fai login come quella persona e fai check-in): il nome nuovo deve comparire anche in "In palestra ora".
4. **Test dell'errore** (richiede i DevTools del browser):
   - Apri DevTools (F12) → tab "Network" → imposta il throttling su "Offline", oppure blocca manualmente la richiesta verso `*/rpc/manager_set_person_name`.
   - Ripeti "Modifica nome" → "Conferma".
   - Atteso: compare il banner rosso "Non è stato possibile cambiare il nome. Riprova.", il form **resta aperto** con il testo che avevi scritto (non sparisce, non si chiude da solo).
   - Riattiva la rete e premi di nuovo "Conferma": deve funzionare normalmente.

**Controprova SQL** (facoltativa):
```sql
select proname from pg_proc where proname in
  ('manager_set_person_name','create_invite','redeem_invite','get_invite_info');
select to_regclass('public.invites');
```
Devono risultare tutte e 5 le righe/tabelle.

---

## Bug 3 — Check-in mai chiusi lato server

**Cosa è stato fatto**: due job `pg_cron` (ogni 5 minuti):
- `close_stale_checkins`: chiude i check-in Cliente fermi da oltre 105 minuti.
- `close_coach_checkins_at_closing`: chiude i check-in Coach quando la palestra risulta chiusa (orario **o** toggle manuale).

Più un filtro difensivo (ignora comunque righe aperte da oltre 12 ore) in `get_live_band` e nella lista "In palestra ora" del Manager.

**Come testarlo (senza aspettare ore reali)**:

Questo è l'unico bug che non si testa cliccando nell'app — il cambiamento è invisibile finché non passano i minuti richiesti. Due modi:

### A. Verifica passiva (comoda, ma richiede che qualcuno dimentichi davvero un check-in)
Nell'SQL Editor, controlla che non ci siano righe aperte da troppo tempo:
```sql
select id, kind, s.name as site, checkin_at,
       round(extract(epoch from now()-checkin_at)/3600, 1) as ore_aperto
from checkins c join sites s using(site_id)
where checkout_at is null;
```
Nessuna riga dovrebbe mai superare ~2 ore (105 min per i Clienti, orario di chiusura per i Coach, più il margine dei 5 minuti del cron).

### B. Verifica attiva (per riprodurlo subito, senza aspettare che capiti da solo)
1. Fai login come **Cliente**, fai check-in (serve essere entro il raggio della palestra — vedi Bug 1).
2. Nell'SQL Editor, retrodata manualmente la conferma per simulare "è passato tempo" (sostituisci `<ID_RIGA>` con l'id della riga appena creata, visibile con `select * from checkins where checkout_at is null order by checkin_at desc limit 1;`):
   ```sql
   update checkins set last_confirmed_at = now() - interval '110 minutes' where id = <ID_RIGA>;
   ```
3. Aspetta fino a 5 minuti (il cron gira ogni 5 min, agli orari `:00 :05 :10 :15 ...`).
4. Ricontrolla: `select checkout_at from checkins where id = <ID_RIGA>;` → deve essere valorizzato.
5. Nell'app, come Manager → "Situazione" → quella persona non deve più comparire in "In palestra ora", e la fascia LIVE deve tornare "Libera" se non c'è nessun altro check-in recente.

**Verifica che i job esistano e girino senza errori**:
```sql
select jobid, jobname, schedule, active from cron.job;

select jobid, status, start_time, end_time, return_message
from cron.job_run_details
order by start_time desc limit 20;
```
Attesi: 2 job (`close_stale_checkins`, `close_coach_checkins_at_closing`), entrambi `active = true`; nessuna riga con `status = 'failed'` nelle esecuzioni recenti.

---

## Riepilogo risultati (sessione di test già eseguita)

| Bug | Esito | Note |
|---|---|---|
| 1 — Posizione palestra | ✅ Risolto | UI presente per Manager e Admin, RPC verificata live (check-in lontano rifiutato, vicino accettato). 6 palestre su 7 aspettano ancora che qualcuno prema "Salva posizione" una prima volta — non è un bug, va fatto una volta a testa |
| 2 — Rename persone | ✅ Risolto | 2 migration mancanti applicate; errore ora visibile col form che resta aperto; verificato che il nuovo nome compaia subito anche in "In palestra ora" |
| 3 — Check-in mai chiusi | ✅ Risolto | Entrambi i job attivi e verificati con esecuzioni reali (non simulate); durante il test è emerso un piccolo problema di robustezza (un dato anomalo poteva bloccare l'intero job per tutte le palestre) ed è stato corretto con una migration aggiuntiva (`greatest(...)`) |
