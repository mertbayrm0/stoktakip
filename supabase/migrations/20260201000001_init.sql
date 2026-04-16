-- Depozio Initial Schema
-- Run this in your Supabase SQL editor or via `supabase db push`.
-- ---------------------------------------------------------------

create extension if not exists "uuid-ossp";

-- Workspaces
create table if not exists public.workspaces (
    id uuid primary key default uuid_generate_v4(),
    name text not null,
    type text not null check (type in ('eczane','veteriner')),
    address text default '',
    owner_id uuid not null references auth.users(id) on delete cascade,
    created_at timestamptz not null default now()
);

-- Users profile (extends auth.users)
create table if not exists public.users (
    id uuid primary key references auth.users(id) on delete cascade,
    email text not null unique,
    name text default '',
    role text not null default 'staff' check (role in ('admin','staff')),
    workspace_id uuid references public.workspaces(id) on delete set null,
    created_at timestamptz not null default now()
);

-- Products
create table if not exists public.products (
    id uuid primary key default uuid_generate_v4(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    gtin text not null,
    name text not null,
    brand text default '',
    category text not null check (category in ('otc','supplement','kozmetik','bebek','mama','aksesuar','sarf')),
    content_ml_g text default '',
    description text default '',
    image_url text default '',
    unit text default 'kutu',
    created_at timestamptz not null default now(),
    unique (workspace_id, gtin)
);
create index if not exists idx_products_ws on public.products(workspace_id);

-- Inventory (1:1 with product)
create table if not exists public.inventory (
    id uuid primary key default uuid_generate_v4(),
    product_id uuid not null unique references public.products(id) on delete cascade,
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    current_stock integer not null default 0,
    min_threshold integer not null default 5,
    max_threshold integer not null default 50,
    last_counted_at timestamptz default now()
);
create index if not exists idx_inventory_ws on public.inventory(workspace_id);

create table if not exists public.inventory_logs (
    id uuid primary key default uuid_generate_v4(),
    inventory_id uuid not null references public.inventory(id) on delete cascade,
    change jsonb not null,
    reason text default '',
    created_at timestamptz not null default now(),
    created_by uuid references public.users(id) on delete set null
);

-- Suppliers
create table if not exists public.suppliers (
    id uuid primary key default uuid_generate_v4(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    name text not null,
    contact_phone text default '',
    contact_email text default '',
    order_method text not null default 'email' check (order_method in ('email','whatsapp','manual')),
    price_list_updated_at timestamptz,
    is_active boolean not null default true,
    created_at timestamptz not null default now()
);

create table if not exists public.supplier_prices (
    id uuid primary key default uuid_generate_v4(),
    supplier_id uuid not null references public.suppliers(id) on delete cascade,
    product_id uuid not null references public.products(id) on delete cascade,
    unit_price numeric(12,2) not null,
    stock_available integer not null default 0,
    updated_at timestamptz not null default now(),
    unique (supplier_id, product_id)
);
create index if not exists idx_sp_product on public.supplier_prices(product_id);

-- Orders
create table if not exists public.orders (
    id uuid primary key default uuid_generate_v4(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    supplier_id uuid not null references public.suppliers(id),
    order_no text not null,
    status text not null default 'draft' check (status in ('draft','sent','in_transit','delivered','cancelled')),
    total_amount numeric(12,2) not null default 0,
    total_saving numeric(12,2) not null default 0,
    notes text default '',
    sent_at timestamptz,
    delivered_at timestamptz,
    created_at timestamptz not null default now(),
    created_by uuid references public.users(id) on delete set null
);
create index if not exists idx_orders_ws on public.orders(workspace_id, created_at desc);

create table if not exists public.order_items (
    id uuid primary key default uuid_generate_v4(),
    order_id uuid not null references public.orders(id) on delete cascade,
    product_id uuid not null references public.products(id),
    qty integer not null check (qty >= 1),
    unit_price numeric(12,2) not null default 0,
    created_at timestamptz not null default now()
);
create index if not exists idx_oi_order on public.order_items(order_id);

-- Discount rules (İskonto)
create table if not exists public.discount_rules (
    id uuid primary key default uuid_generate_v4(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    supplier_id uuid not null references public.suppliers(id) on delete cascade,
    min_amount numeric(12,2) not null default 0,
    max_amount numeric(12,2),
    discount_pct numeric(5,2) not null default 0,
    created_at timestamptz not null default now()
);
