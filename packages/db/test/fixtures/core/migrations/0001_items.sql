create table {{schema}}.items (id uuid primary key default gen_random_uuid(), name text not null);
alter table {{schema}}.items enable row level security;
