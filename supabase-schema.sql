create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  google_id text unique not null,
  name text not null,
  email text not null,
  created_at timestamptz not null default now()
);

create table if not exists sites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  site_name text not null,
  drive_folder_url text not null,
  drive_folder_id text not null,
  public_slug text unique not null,
  primary_color text default '#2563eb',
  logo_url text default '',
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pages (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  google_doc_id text not null,
  title text not null,
  clean_title text not null,
  page_order integer not null,
  html_content text not null,
  updated_at timestamptz not null default now()
);

create index if not exists pages_site_order_idx on pages(site_id, page_order);
create index if not exists sites_public_slug_idx on sites(public_slug);
