# Giriş (Auth)

## Önerilen: Google ile giriş

**E-posta limitine takılmaz** (magic link Supabase free tier’da ~4/saat).

### Google kurulumu (bir kez)

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → OAuth client (Gmail ile aynı olabilir)
2. **Authorized redirect URIs** ekle:
   - `https://uhepdwjqkyjdiaugtjln.supabase.co/auth/v1/callback`
3. [Supabase → Providers → Google](https://supabase.com/dashboard/project/uhepdwjqkyjdiaugtjln/auth/providers) → **Enable**
4. Client ID + Secret yapıştır → Save

### URL Configuration

**Redirect URLs:**
- `http://localhost:3000/auth/callback**`
- `https://aslico-toolkit-web-indol.vercel.app/auth/callback**`

### Giriş

1. `/login` → **Google ile giriş** (önerilen)
2. veya **Magic link gönder** (limit dolunca ~1 saat bekle)

---

## Magic link

**Authentication** → **Providers** → **Email** → Enabled

---

## İsteğe bağlı: Passkey / Touch ID

Tek domain — local + production birlikte çalışmaz. Varsayılan: kapalı.

```env
NEXT_PUBLIC_PASSKEY_ENABLED=true
```

---

## Env özeti

| Değişken | Açıklama |
|----------|----------|
| `ALLOWED_EMAIL` | Tek kullanıcı e-postası |
| `NEXT_PUBLIC_ALLOWED_EMAIL` | Login ekranı |
| `NEXT_PUBLIC_PASSKEY_ENABLED` | Passkey (opsiyonel) |
