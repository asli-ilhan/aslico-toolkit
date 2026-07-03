# Giriş (Auth)

## Önerilen: Magic link

**Local ve production aynı şekilde çalışır.** Supabase RP ID değiştirmene gerek yok.

### Supabase ayarı (bir kez)

1. [Supabase Dashboard](https://supabase.com/dashboard) → **Authentication** → **Providers** → **Email** → **Enabled**
2. **Authentication** → **URL Configuration** → **Redirect URLs** listesine ekle:
   - `http://localhost:3000/auth/callback**`
   - `https://aslico-toolkit-web-indol.vercel.app/auth/callback**` (production URL’in)

### Giriş akışı

1. `/login` → **Magic link gönder**
2. E-postadaki linke tıkla → dashboard

Acil bypass (UI’da yok): yalnızca `ALLOW_SETUP=true` + `SUPABASE_SERVICE_ROLE_KEY` ile `/api/auth/setup` — production’da açma.

Vercel env: `ALLOWED_EMAIL`, `NEXT_PUBLIC_ALLOWED_EMAIL`, Supabase keys, `NEXT_PUBLIC_APP_URL`

---

## İsteğe bağlı: Passkey / Touch ID

> **Uyarı:** WebAuthn passkey’ler **tek bir domain**e bağlıdır. Supabase’de yalnızca **bir RP ID** olur. Local (`localhost`) ve production (Vercel) **aynı anda çalışmaz** — RP ID’yi sürekli değiştirmek gerekir. Bu yüzden varsayılan olarak **kapalıdır**.

Açmak için `.env.local` / Vercel:

```env
NEXT_PUBLIC_PASSKEY_ENABLED=true
```

Sonra Supabase → Passkeys → RP ID ve Origin’i **o an kullandığın domain** ile eşleştir.

---

## Env özeti

| Değişken | Açıklama |
|----------|----------|
| `ALLOWED_EMAIL` | Tek kullanıcı e-postası (sunucu) |
| `NEXT_PUBLIC_ALLOWED_EMAIL` | Login ekranında gösterilir |
| `SUPABASE_SERVICE_ROLE_KEY` | Dev setup linki için |
| `NEXT_PUBLIC_PASSKEY_ENABLED` | `true` ise Touch ID seçeneği görünür |
