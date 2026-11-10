-- ТАУ — демо-магазин. Начальная схема базы Supabase.
-- Запускается один раз в SQL Editor проекта. Секретов здесь нет.
-- Безопасность: RLS включена на всех таблицах. Посетители не читают заказы и не пишут в таблицы напрямую.

-- ============ Таблицы ============

create table public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin')),
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  description text not null default '',
  price integer not null check (price >= 0),          -- цена в тенге
  category text not null check (category in ('hoodies', 'tshirts', 'pants', 'outerwear')),
  is_new boolean not null default false,
  published boolean not null default true,
  images text[] not null default '{}',                 -- пути к файлам в Storage, не сами фото
  created_at timestamptz not null default now()
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  color text not null,
  size text not null,
  stock integer not null default 0 check (stock >= 0),
  unique (product_id, color, size)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  is_demo boolean not null default true,               -- отделяет тестовые заказы от будущих настоящих
  status text not null default 'Тестовый',
  customer_name text not null,
  phone text not null,
  city text not null,
  address text not null,
  total integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_name text not null,
  color text not null,
  size text not null,
  qty integer not null check (qty between 1 and 10),
  price integer not null check (price >= 0)
);

create table public.settings (
  key text primary key,
  value jsonb not null
);
insert into public.settings (key, value) values ('demo_orders_enabled', 'true'::jsonb);

create sequence public.demo_order_seq;

-- ============ Помощники для проверки прав ============

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('owner', 'admin'));
$$;

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'owner');
$$;

-- ============ Row Level Security ============

alter table public.user_roles enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.settings enable row level security;

-- Роли: каждый видит только свою роль; управлять ролями может только владелец.
-- Первого владельца добавляет только администратор проекта через SQL Editor (не из браузера).
create policy "roles: read own or owner" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_owner());
create policy "roles: owner manages" on public.user_roles for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- Товары: посетители видят только опубликованные; админы — всё.
create policy "products: public read published" on public.products for select to anon, authenticated
  using (published = true);
create policy "products: admin all" on public.products for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "variants: public read of published" on public.product_variants for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.published));
create policy "variants: admin all" on public.product_variants for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Заказы, позиции и настройки: только админы. Посетители не читают и не пишут напрямую.
create policy "orders: admin all" on public.orders for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "order_items: admin all" on public.order_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "settings: admin all" on public.settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Дополнительно закрываем доступ анонимным посетителям к закрытым таблицам.
revoke all on public.user_roles, public.orders, public.order_items, public.settings from anon;
revoke all on public.demo_order_seq from anon, authenticated;

-- ============ Тестовый заказ: единственный путь для посетителя ============
-- Цена и наличие проверяются на сервере. Цену из браузера не принимаем.

create or replace function public.create_demo_order(
  p_name text, p_phone text, p_city text, p_address text, p_items jsonb
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_enabled boolean;
  v_order_id uuid;
  v_number text;
  v_total integer := 0;
  it jsonb;
  v_prod public.products%rowtype;
  v_stock integer;
  v_qty integer;
begin
  select (value #>> '{}')::boolean into v_enabled from public.settings where key = 'demo_orders_enabled';
  if coalesce(v_enabled, false) = false then
    raise exception 'Демо-заказы отключены';
  end if;

  if char_length(trim(coalesce(p_name, ''))) not between 2 and 100
     or char_length(trim(coalesce(p_phone, ''))) not between 10 and 30
     or char_length(trim(coalesce(p_city, ''))) not between 2 and 100
     or char_length(trim(coalesce(p_address, ''))) not between 3 and 200 then
    raise exception 'Проверьте поля формы';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 20 then
    raise exception 'Корзина пуста или слишком большая';
  end if;

  v_number := 'DEMO-' || lpad(nextval('public.demo_order_seq')::text, 3, '0');

  insert into public.orders (number, customer_name, phone, city, address, total)
  values (v_number, trim(p_name), trim(p_phone), trim(p_city), trim(p_address), 0)
  returning id into v_order_id;

  for it in select * from jsonb_array_elements(p_items) loop
    v_qty := (it ->> 'qty')::integer;
    if v_qty is null or v_qty < 1 or v_qty > 10 then
      raise exception 'Неверное количество';
    end if;

    select * into v_prod from public.products where id = (it ->> 'product_id')::uuid and published;
    if not found then
      raise exception 'Товар не найден';
    end if;

    select stock into v_stock from public.product_variants
      where product_id = v_prod.id and color = it ->> 'color' and size = it ->> 'size';
    if v_stock is null or v_stock < v_qty then
      raise exception 'Недостаточно товара на складе';
    end if;

    insert into public.order_items (order_id, product_name, color, size, qty, price)
    values (v_order_id, v_prod.name, it ->> 'color', it ->> 'size', v_qty, v_prod.price);
    v_total := v_total + v_prod.price * v_qty;
  end loop;

  update public.orders set total = v_total where id = v_order_id;
  return v_number;
end;
$$;

revoke all on function public.create_demo_order(text, text, text, text, jsonb) from public;
grant execute on function public.create_demo_order(text, text, text, text, jsonb) to anon, authenticated;

-- ============ Хранилище фотографий ============
-- Читать фото могут все, загружать и удалять — только админы.

insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "images: public read" on storage.objects for select to anon, authenticated
  using (bucket_id = 'product-images');
create policy "images: admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());
create policy "images: admin update" on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.is_admin());
create policy "images: admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.is_admin());
