# Depozio — Supabase migrations

Bu klasör Supabase için hazırlanmış SQL migration dosyalarını içerir. Vercel + Supabase kurulumu sonrası:

```bash
supabase db push                 # migrations klasöründeki dosyaları sırayla uygular
# veya Supabase Studio → SQL editor'e tek tek yapıştırabilirsin
```

## Dosyalar

- `20260201000001_init.sql` — Tüm tablolar (users, workspaces, products, inventory, inventory_logs, suppliers, supplier_prices, orders, order_items, discount_rules)
- `20260201000002_rls.sql` — Row Level Security politikaları (her satır `workspace_id`'ye göre izole)

## Auth entegrasyonu (Supabase tarafı)

Supabase Auth kullanılırken, kayıt sonrası bir trigger ile `public.users` satırı yaratılmalı:

```sql
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer as $$
begin
  insert into public.users (id, email, role)
  values (new.id, new.email, 'admin')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

## Custom JWT claim (workspace_id)

Kullanıcı JWT'sine `workspace_id` eklemek için Supabase `auth.hook` veya Edge Function kullanılmalı. Alternatif olarak frontend, `/api/workspace` endpoint'inden workspace context'i alır (mevcut yaklaşım).

## Seed data

Örnek ürün, tedarikçi ve fiyat verileri FastAPI backend tarafında `seed_workspace_data()` fonksiyonunda bulunur. Supabase tarafında aynı seed'i uygulamak için `supabase/seed.sql` dosyası yaratılabilir (TODO).
