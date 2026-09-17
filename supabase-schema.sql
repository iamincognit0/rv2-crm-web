-- Run this once in your Supabase project's SQL Editor (Supabase dashboard -> SQL Editor -> New query)

create table if not exists crm_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table crm_data enable row level security;

-- Each logged-in user can only ever see or touch their own row.
create policy "Users can view their own data"
  on crm_data for select
  using (auth.uid() = user_id);

create policy "Users can insert their own data"
  on crm_data for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own data"
  on crm_data for update
  using (auth.uid() = user_id);
