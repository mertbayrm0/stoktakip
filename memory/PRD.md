# Depozio — Product Requirements Document

## Orijinal problem statement
B2B SaaS: eczane ve veteriner kliniklerin 3. parti (OTC / supplement / pet) satın alım süreci. User brief: React + Supabase + Vercel. Bu sürüm sadece **eczane** modu, FastAPI + MongoDB üzerinde MVP. Supabase için SQL migration'ları bonus olarak `/app/supabase/migrations/` altında.

## Personas
- **Eczane yöneticisi (admin)**: Fiyat karşılaştırır, siparişleri onaylar ve tedarikçiye gönderir. Kural/tedarikçi/kullanıcı yönetimi.
- **Eczane personeli (staff)**: Barkod tarar (elle veya kamera), taslak sipariş ekler, stok sayımı günceller.

## Core Requirements (statik)
- JWT auth, role (admin/staff), workspace bazlı izolasyon
- 8 ekran — hepsi canlı
- Primary accent #1a6b4a, Cabinet Grotesk + Satoshi, Türkçe UI, lucide-react

---

## Uygulanan — MVP + Tüm İterasyonlar

### Backend (FastAPI + MongoDB) — 53/53 test geçti
- `/api/auth/*` — register, login, logout, me (bcrypt + PyJWT)
- `/api/workspace/*` — setup + get
- `/api/products` — list + create + `/products/search`
- `/api/inventory` — list + filter=critical + PATCH + `/inventory/critical` + **POST /inventory/csv** (toplu yükleme, UTF-8 BOM toleranslı, inventory_logs kaydı)
- `/api/suppliers` — CRUD tam (list + POST + **PATCH + DELETE** admin-only)
- `/api/supplier-prices/by-product/{id}` + **POST /supplier-prices/csv?supplier_id=X** (fiyat listesi toplu yükleme)
- `/api/orders` — list + filter + create (grouped by supplier, reuses draft) + /orders/{id} + /orders/{id}/send (admin, MOCK email) + status patch
- `/api/dashboard/stats`
- **`/api/discount-rules`** — list, POST (admin), DELETE (admin)
- **`/api/reports/monthly-savings`** — son 6 ay bucket
- **`/api/reports/category-distribution`** — kategori kırılımı
- **`/api/reports/orders-csv`** — StreamingResponse CSV export
- Otomatik seed: admin + staff + Demo Eczane + 50 ürün + 3 tedarikçi + fiyat listeleri

### Frontend (React + Tailwind + shadcn + recharts)
**Auth:**
- `/login` `/register` — split-screen eczane foto + gradient
- `/onboarding` — tek adım workspace setup

**Core ekranlar:**
- `/dashboard` — hero scan bar (GTIN/ürün adı) + **kamera barkod okuma** (html5-qrcode) + 4 stat + kritik stok widget (quick-order) + son siparişler
- `/katalog` — 50-satır tablo + kategori pill + arama + ürün ekle modal + sağdan drawer
- `/stok` — inline tabs + renkli stok chip + düzenle drawer + **gerçek CSV upload** (şablon indirme + result panel)
- `/siparis` — 3 tab + #SIP-YYMMDDxxx + detail drawer + gönder modal

**Yeni (iterasyon 3):**
- `/tedarikci` — CRUD tablo + per-row fiyat CSV upload + silme onayı
- `/raporlar` — 3 stat kartı + recharts bar chart (aylık tasarruf) + kategori dağılımı progress bar + siparişler CSV export
- `/iskonto` — client-side hesaplayıcı + admin için kural CRUD
- `/entegrasyon` — 7 entegrasyon kartı (Veri/Otomasyon/İletişim/Tedarikçi/Fiyat) status badge

**Shared:**
- AuthContext + ProtectedRoute (AppLayout redirect logic)
- Sidebar: 8 ana menü item, kullanıcı avatar + logout
- BarcodeScanner component (kamera izin hatalarını zarif handle ediyor)

### Supabase (bonus — kullanılmıyor ama hazır)
- `/app/supabase/migrations/20260201000001_init.sql` — 10 tablo + FK + index
- `/app/supabase/migrations/20260201000002_rls.sql` — workspace-scoped RLS
- `/app/supabase/README.md` — deploy talimatları

---

## MOCKED / Implementation Pending
- **Email gönderimi**: `POST /api/orders/{id}/send` sadece console log. Resend/SendGrid API anahtarı eklenerek aktifleştirilir (backend kodu template için hazır).
- Entegrasyon placeholder'ları: `/app/frontend/src/lib/integrations/{gs1,eczanem,bulutvet,email}.js` boş fonksiyonlarla.

---

## Backlog (sonraki)

### P1 — Yapılabilir geliştirmeler
- [ ] Resend/SendGrid gerçek email (HTML template'i backend'de mevcut değil, order items'ı loop edip basit bir HTML oluştur)
- [ ] Forgot/reset password endpointleri + UI
- [ ] `test-auth` brute force protection tablosu (playbook'ta var, opsiyonel)
- [ ] Raporlar: kâr marjı hesabı (maliyet tracking eklemek gerekir)

### P2 — 3rd party bağımlı
- [ ] GS1 Türkiye Verified API — `lookupByGtin()` fonksiyonu hazır
- [ ] Eczanem / İlon SOAP
- [ ] BulutVet REST API
- [ ] Toptancı gerçek zamanlı stok API
- [ ] WhatsApp Business API
- [ ] PWA + `getUserMedia` mobil kurulum
- [ ] Trendyol/HB scraper
- [ ] Veteriner modu (workspace.type değişimi ile sidebar label + renk accent + kategori listesi dinamikleşir)
- [ ] Supabase production deploy (migrations hazır, SQL'e geç + Auth trigger ekle)

---

## Test Credentials
- Admin: admin@depozio.com / admin123
- Staff: staff@depozio.com / staff123

## Stack
- Backend: FastAPI + Motor (MongoDB), bcrypt, PyJWT, python-multipart
- Frontend: React 19 + CRA + Tailwind + shadcn/ui + sonner + lucide-react + date-fns + recharts + html5-qrcode
- Fonts: Cabinet Grotesk + Satoshi (Fontshare)

## Test History
- İterasyon 1: 30/30 backend + full frontend (temel MVP)
- İterasyon 2: 36/36 backend (kamera + inventory CSV)
- İterasyon 3: 53/53 backend (suppliers CRUD + price CSV + discount + reports)
