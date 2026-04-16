-- Row Level Security for Depozio
-- Strategy: every row has a workspace_id; users can only access rows whose
-- workspace_id matches their own (via public.users.workspace_id).
-- ---------------------------------------------------------------

-- Helper: return current user's workspace_id
create or replace function public.current_workspace_id() returns uuid
language sql stable as $$
    select workspace_id from public.users where id = auth.uid();
$$;

-- Helper: is current user admin?
create or replace function public.is_admin() returns boolean
language sql stable as $$
    select coalesce((select role = 'admin' from public.users where id = auth.uid()), false);
$$;

-- Enable RLS
alter table public.workspaces enable row level security;
alter table public.users enable row level security;
alter table public.products enable row level security;
alter table public.inventory enable row level security;
alter table public.inventory_logs enable row level security;
alter table public.suppliers enable row level security;
alter table public.supplier_prices enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.discount_rules enable row level security;

-- Users: self read + read mates in same workspace
create policy users_self on public.users for select
    using (id = auth.uid() or workspace_id = public.current_workspace_id());
create policy users_update_self on public.users for update
    using (id = auth.uid());

-- Workspaces: owner/member read, owner update
create policy ws_member_read on public.workspaces for select
    using (id = public.current_workspace_id() or owner_id = auth.uid());
create policy ws_owner_update on public.workspaces for update
    using (owner_id = auth.uid());

-- Generic workspace-scoped template
create policy products_ws on public.products for all
    using (workspace_id = public.current_workspace_id())
    with check (workspace_id = public.current_workspace_id());

create policy inventory_ws on public.inventory for all
    using (workspace_id = public.current_workspace_id())
    with check (workspace_id = public.current_workspace_id());

create policy inventory_logs_ws on public.inventory_logs for all
    using (exists (select 1 from public.inventory i where i.id = inventory_id and i.workspace_id = public.current_workspace_id()));

create policy suppliers_ws on public.suppliers for all
    using (workspace_id = public.current_workspace_id())
    with check (workspace_id = public.current_workspace_id());

create policy supplier_prices_ws on public.supplier_prices for all
    using (exists (select 1 from public.suppliers s where s.id = supplier_id and s.workspace_id = public.current_workspace_id()));

create policy orders_ws_read on public.orders for select
    using (workspace_id = public.current_workspace_id());
create policy orders_ws_insert on public.orders for insert
    with check (workspace_id = public.current_workspace_id());
-- Only admin can update orders (status transitions). Staff limited to drafts (via app logic).
create policy orders_ws_update on public.orders for update
    using (workspace_id = public.current_workspace_id() and public.is_admin());

create policy order_items_ws on public.order_items for all
    using (exists (select 1 from public.orders o where o.id = order_id and o.workspace_id = public.current_workspace_id()));

create policy discount_ws on public.discount_rules for all
    using (workspace_id = public.current_workspace_id())
    with check (workspace_id = public.current_workspace_id());
