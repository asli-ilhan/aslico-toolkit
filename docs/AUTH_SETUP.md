# Supabase Passkey Kurulumu

Bu rehber, **asliCo Toolkit** için Touch ID / Face ID (WebAuthn passkey) girişini adım adım açmanı sağlar.

## 1. Supabase Dashboard — Passkeys aç

1. [Supabase Dashboard](https://supabase.com/dashboard) → projen: `uhepdwjqkyjdiaugtjln`
2. **Authentication** → **Passkeys**
3. **Enable Passkey authentication** → AÇ
4. Şu değerleri gir:

| Alan | Local dev | Production (Vercel) |
|------|-----------|---------------------|
| **Relying Party Display Name** | `asliCo's Toolkit` | `asliCo's Toolkit` |
| **Relying Party ID** | `localhost` | `senin-domain.com` (scheme yok!) |
| **Relying Party Origins** | `http://localhost:3000` | `https://senin-domain.vercel.app` |

> **Önemli:** RP ID bir kez seçilir ve değiştirilirse eski passkey’ler çalışmaz. Production domain’ini önceden planla.

## 2. Site URL ve redirect

**Authentication** → **URL Configuration**:

- **Site URL:** `http://localhost:3000` (dev) veya production URL
- **Redirect URLs** listesine ekle:
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3000/auth/callback/**`
  - `http://localhost:3000/**`
  - Production URL’lerini de ekle

## 3. E-posta (ilk kurulum için)

Passkey **kaydı** için önce bir kez giriş yapman gerekir (Supabase kuralı).

**Authentication** → **Providers** → **Email**:
- Email provider: **Enabled**
- (İsteğe bağlı) Confirm email: açık bırak — magic link zaten doğrular

## 4. Env değişkenleri

`apps/web/.env.local` dosyasında (zaten oluşturuldu):

```env
NEXT_PUBLIC_SUPABASE_URL=https://uhepdwjqkyjdiaugtjln.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_wwVRL_WMDVWrkYSG6lZcbw_MeOVxz7r
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Anahtarları bulmak için: **Project Settings** → **API** → **Project URL** ve **Publishable key**.

> `sb_publishable_...` yeni format. Eski projelerde `anon` JWT key (`eyJ...`) de çalışır.

## 5. İlk giriş akışı

```
1. /login → "E-posta (ilk kurulum)" sekmesi
2. E-postanı gir → magic link gelir
3. Linke tıkla → /account/passkeys sayfasına yönlendirilirsin
4. "Yeni passkey ekle" → Touch ID / Face ID onayı
5. Sonraki girişler: /login → "Passkey ile devam et"
```

## 6. Hata kodları

| Hata | Çözüm |
|------|--------|
| `passkey_disabled` | Dashboard’da Passkeys’i aç |
| `webauthn_credential_not_found` | Önce e-posta ile giriş yap, passkey kaydet |
| `webauthn_verification_failed` | RP ID / Origins localhost ile eşleşmiyor — Dashboard’ı kontrol et |
| Magic link gelmiyor | Email provider açık mı? Redirect URL doğru mu? |

## 7. Production (Vercel)

1. Vercel env’e aynı `NEXT_PUBLIC_*` değişkenlerini ekle
2. Supabase Passkeys → Origins’e Vercel URL’ini ekle
3. RP ID’yi production domain yap (ör. `aslico.dev`)
4. Site URL ve Redirect URLs’i güncelle

## API referansı

- [Supabase Passkeys docs](https://supabase.com/docs/guides/auth/passkeys)
- `signInWithPasskey()` — giriş
- `registerPasskey()` — kayıt (giriş yapmış olmalısın)
- `passkey.list()` / `delete()` — yönetim
