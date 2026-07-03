# Gmail backend setup

## Option A — Dev server page (recommended)

Uses the same redirect URI as the app — **no port 8787**.

1. Dev server running: `npx pnpm@9.15.9 dev`
2. Google Cloud Console → **Credentials** → your **Web** OAuth client (same `GOOGLE_CLIENT_ID` as `.env.local`)
3. **Authorized redirect URIs** → add **exactly** (copy-paste, then **Save**):
   ```
   http://localhost:3000/api/auth/gmail/callback
   ```
4. Run `node scripts/gmail-refresh-token.mjs` or open:
   ```
   http://localhost:3000/api/dev/gmail-token
   ```
5. Follow the page → **Google ile devam et** → approve Gmail send scope
6. Copy `GMAIL_REFRESH_TOKEN` from the page or dev server terminal into `apps/web/.env.local`
7. Restart dev server

### `redirect_uri_mismatch`

The URI in Google Console must match `GOOGLE_REDIRECT_URI` in `.env.local` **character for character**:
- `http` not `https` on localhost
- no trailing slash
- path is `/api/auth/gmail/callback` (not `/api/dev/...`)

Common mistake: editing the wrong OAuth client — check Client ID matches `.env.local`.

### `403 access_denied` / "has not completed the Google verification process"

OAuth consent screen is in **Testing** mode. Only listed test users can sign in.

1. [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **OAuth consent screen**
2. Scroll to **Test users** → **+ ADD USERS**
3. Add the Gmail you sign in with (e.g. `a.asliilhan@gmail.com`) → **Save**
4. Retry `http://localhost:3000/api/dev/gmail-token`

Publishing the app publicly requires Google verification for Gmail scopes — for personal use, test user is enough.

If no `refresh_token`: revoke app at https://myaccount.google.com/permissions and try again.


1. [Google OAuth Playground](https://developers.google.com/oauthplayground)
2. **Same Google Cloud project** → OAuth client → **Authorized redirect URIs** must include:
   ```
   https://developers.google.com/oauthplayground
   ```
   (Without this, auth fails or tokens are wrong.)
3. Gear icon → **Use your own OAuth credentials** → `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`
4. Left: **Gmail API v1** → `https://www.googleapis.com/auth/gmail.send`
5. **Authorize APIs** → sign in as sender Gmail
6. **Exchange authorization code for tokens**
7. In the JSON on the right, copy **`refresh_token`** (starts with `1//`) — not `access_token`

If `refresh_token` is missing in JSON → revoke app at https://myaccount.google.com/permissions and repeat from step 5.

```env
GMAIL_REFRESH_TOKEN=1//0xxxxx...
GMAIL_SENDER_EMAIL=a.asliilhan@gmail.com
```

---

## Option C — Browser OAuth (app UI)

Google Cloud → OAuth Web client → **Authorized redirect URIs**:

```
http://localhost:3000/api/auth/gmail/callback
```

```env
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/gmail/callback
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`redirect_uri_mismatch` = URI in Google Console does not match character-for-character.

After connect, dev server logs refresh token — you can move it to `GMAIL_REFRESH_TOKEN` (Option A).
