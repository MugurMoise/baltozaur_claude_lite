# 🔔 Setup Push Notifications

## 1. Generează VAPID Keys

```bash
npx web-push generate-vapid-keys
```

Output:
```
Public Key:  BxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxQ
Private Key: yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy
```

## 2. Adaugă în .env (frontend)

```env
VITE_VAPID_PUBLIC_KEY=BxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxQ
```

## 3. Adaugă în Vercel (Environment Variables)

```
VITE_VAPID_PUBLIC_KEY = BxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxQ
```

## 4. Adaugă în Supabase Edge Function Secrets

Mergi în Supabase → Edge Functions → Secrets și adaugă:

```
VAPID_PUBLIC_KEY  = BxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxQ
VAPID_PRIVATE_KEY = yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy
VAPID_SUBJECT     = mailto:admin@baltozaur.ro
```

**Atenție:** `VAPID_PRIVATE_KEY` trebuie să fie în format PKCS8 (base64url).
Conversia din formatul web-push:

```bash
# web-push dă formatul raw — conversia în PKCS8 pentru Deno:
node -e "
const { privateKey } = require('./keys.json');
// sau folosește direct valoarea din npx web-push generate-vapid-keys
console.log(privateKey);
"
```

## 5. Rulează migrarea SQL

În Supabase → SQL Editor, rulează conținutul din:
`supabase/migrations/push_subscriptions.sql`

## 6. Deploy edge function

```bash
supabase functions deploy send-notifications
```

## 7. Verifică cron job

```sql
select * from cron.job where jobname = 'send-evening-notifications';
```

## 8. Test manual

În Supabase → Edge Functions → send-notifications → Invoke

---

## Cum funcționează

1. Utilizatorul apasă 🔕 în header → modal se deschide
2. Selectează județe și/sau distanță maximă
3. Browser cere permisiunea de notificări
4. Subscription se salvează în `push_subscriptions`
5. În fiecare seară la 17:00 UTC (20:00 România):
   - Edge function citește prognoza pentru ziua următoare
   - Pentru fiecare subscription filtrează lacurile după județ/distanță
   - Trimite push notification cu top 3 lacuri

## Structura notificării

```
🦕 Baltozaur — Prognoză Vineri

🟢 Lacul Snagov — 84pts
🟢 Lacul Comana — 78pts  
🟡 Lacul Cernica — 62pts

🎣 Condiții bune mâine!
```
