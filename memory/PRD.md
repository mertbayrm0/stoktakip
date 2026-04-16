# Depozio — Product Requirements Document

## Orijinal problem statement
B2B SaaS uygulaması: eczane ve veteriner kliniklerin 3. parti (OTC / supplement / pet) satın alım sürecini yöneten web platformu. Kullanıcı brief'i: React + Supabase + Vercel stack. Bu sürümde sadece **eczane** modu, FastAPI + MongoDB stack üzerinde MVP olarak inşa edildi; Supabase için SQL migration dosyaları ayrıca hazırlandı (`/app/supabase/migrations/`).

## Personas
- **Eczane yöneticisi (admin)**: Fiyat karşılaştırır, siparişleri onaylar ve tedarikçiye gönderir. Stok eşiklerini belirler.
- **Eczane personeli (staff)**: Barkod tarar, taslak sipariş ekler, stok sayımını günceller.

## Core Requirements (statik)
- JWT tabanlı email+password auth, role (admin/staff), workspace bazlı izolasyon
- 8 ekran: Dashboard, Katalog, Stok, Siparişler, İskonto, Raporlar, Tedarikçiler, Entegrasyonlar
- 3 tedarikçi başlangıç seed'i, 50 ürün demo kataloğu, rastgele stok ve fiyat listesi
- #1a6b4a eczane aksenti, Cabinet Grotesk + Satoshi typography
- Türkçe UI, lucide-react ikonlar

---

## Uygulanan — MVP (16 Nisan 2026)
### Backend (FastAPI + MongoDB)
- `/api/auth/*` — register, login, logout, me (bcrypt + PyJWT, httpOnly cookie + Bearer fallback)
- `/api/workspace/setup` + `/api/workspace` — onboarding flow
- `/api/products` — CRUD + `/products/search` (scan bar)
- `/api/inventory` — list + filter=critical + PATCH + `/inventory/critical` (dashboard widget)
- `/api/suppliers` — list + create
- `/api/supplier-prices/by-product/{id}`
- `/api/orders` — list + filter + create (grouping by supplier, reuses existing draft) + `/orders/{id}` + `/orders/{id}/send` (admin) + status patch
- `/api/dashboard/stats` — 4 metrik + son 3 sipariş
- Otomatik seed: admin + staff + Demo Eczane workspace + 50 ürün + 3 tedarikçi + fiyat listeleri

### Supabase (bonus)
- `/app/supabase/migrations/20260201000001_init.sql` — tüm tablolar + FK + index
- `/app/supabase/migrations/20260201000002_rls.sql` — workspace-scoped Row Level Security
- `/app/supabase/README.md` — deploy talimatları

### Frontend (React + Tailwind + shadcn)
- `/login` `/register` — split-screen eczane foto + gradient overlay
- `/onboarding` — 1-adımlık workspace kurulumu, demo seed otomatik
- `/dashboard` — hero scan bar, 4 stat kartı, kritik stok widget (quick-order), son siparişler
- `/katalog` — 50-satır tablo, kategori pill filtresi, arama, ürün ekle modal, sağdan drawer detay
- `/stok` — inline tabs (Tüm/Kritik/Son 7 gün), renkli stok chip (kırmızı/amber/yeşil), düzenle drawer
- `/siparis` — 3 tab, sipariş no #SIP-YYMMDDxxx, detail drawer, "Tedarikçiye gönder" modal (email MOCK)
- `/iskonto` `/raporlar` `/tedarikci` `/entegrasyon` — ComingSoon placeholder
- AuthContext, ProtectedRoute (AppLayout ile), Sidebar (active state, kullanıcı avatar, logout)

### Test kapsamı
- 30/30 backend API test, tüm frontend akış testleri ✓

---

## MOCKED / TODO
- **Email gönderimi**: `POST /api/orders/{id}/send` sadece console log. Resend veya SendGrid ile gerçek gönderim gerekir.
- **CSV upload** (/stok ve /tedarikci): frontend placeholder toast, backend endpoint yok.

---

## Prioritized Backlog (eksik ekranlar checklist)

### P0 — Eksik ana ekranlar
- [ ] **İskonto hesabı** sayfası: `discount_rules` CRUD + toptancı seçimi + ciro input + client-side hesaplama tablosu
- [ ] **Raporlar**: aylık tasarruf bar chart (recharts), kategori dağılımı progress barı, CSV export
- [ ] **Tedarikçiler**: CRUD (ekle/düzenle/sil modalı) + fiyat listesi CSV upload (gtin, unit_price, stock_available → supplier_prices upsert)
- [ ] **Entegrasyonlar**: statik liste + placeholder dosyaları (`/lib/integrations/eczanem.ts`, `bulutvet.ts`, `gs1.ts`)

### P1 — Entegrasyonlar
- [ ] Resend veya SendGrid ile gerçek email gönderimi (order_items HTML template)
- [ ] CSV upload endpoint'i `/api/inventory/csv` (headers: gtin, current_stock, min_threshold, max_threshold → upsert)
- [ ] CSV upload `/api/supplier-prices/csv` (per supplier)
- [ ] Password reset akışı (`/auth/forgot-password`, `/auth/reset-password`)

### P2 — Sonraki aşama (placeholder olarak bırakıldı)
- [ ] GS1 Türkiye Verified API — barkod→ürün bilgisi otomatik çekme
- [ ] Eczanem / İlon SOAP entegrasyonu — stok senkronizasyonu
- [ ] BulutVet REST API — veteriner modu
- [ ] Toptancı gerçek zamanlı stok API — supplier_prices auto refresh
- [ ] WhatsApp Business API — sipariş iletimi
- [ ] Mobil PWA + `getUserMedia` barkod kamerası
- [ ] Trendyol/HB fiyat karşılaştırma scrapers
- [ ] Veteriner modu (renk, kategori, sidebar label değişimi)
- [ ] Supabase production deployment (mevcut SQL migrations ile)

---

## Test Credentials
- Admin: admin@depozio.com / admin123
- Staff: staff@depozio.com / staff123

## Stack
- Backend: FastAPI + Motor (MongoDB), bcrypt, PyJWT
- Frontend: React 19 + CRA + Tailwind + shadcn/ui + sonner + lucide-react + date-fns + recharts
- Fonts: Cabinet Grotesk + Satoshi (Fontshare)
