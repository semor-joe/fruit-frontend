-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create users table (extends auth.users)
create table public.users (
  id uuid references auth.users not null primary key,
  openid text unique,
  nickname text,
  avatar_url text,
  phone_number text,  -- optional contact number
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Migration for existing databases: add phone_number if the table already exists
-- Run this if you already have the users table and want to add the column:
--   alter table public.users add column if not exists phone_number text;

-- Create land_blocks table
create table public.land_blocks (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) not null,
  name text not null,
  location text,
  area numeric,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create fertilizers table
-- Note: These seem to be per-usage instances based on frontend logic
create table public.fertilizers (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  amount numeric not null,
  unit text not null,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create fruit_information table
create table public.fruit_information (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) not null,
  land_block_id uuid references public.land_blocks(id) not null,
  session_id text,
  img_url text,
  fertilizer_ids uuid[], -- Array of fertilizer IDs
  content text,
  extracted_data jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create images table (optional, based on usage in database.ts uploadImage)
create table public.images (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id),
  image_url text not null,
  content text,
  file_path text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table public.users enable row level security;
alter table public.land_blocks enable row level security;
alter table public.fertilizers enable row level security;
alter table public.fruit_information enable row level security;
alter table public.images enable row level security;

-- Create Policies

-- Users can only read/update their own profile
create policy "Users can view own profile" on public.users
  for select using (auth.uid() = id);

create policy "Users can insert own profile" on public.users
  for insert with check (auth.uid() = id);

create policy "Users can update own profile" on public.users
  for update using (auth.uid() = id);

-- Land Blocks: Users can only see and manage their own blocks
create policy "Users can view own land blocks" on public.land_blocks
  for select using (auth.uid() = user_id);

create policy "Users can insert own land blocks" on public.land_blocks
  for insert with check (auth.uid() = user_id);

create policy "Users can update own land blocks" on public.land_blocks
  for update using (auth.uid() = user_id);

create policy "Users can delete own land blocks" on public.land_blocks
  for delete using (auth.uid() = user_id);

-- Fertilizers: 
-- Since they are created by users but not explicitly linked to user_id in the table definition inferred,
-- we might need to add user_id to fertilizers table for proper RLS, or allow public read/insert if they are ephemeral.
-- However, best practice is to link them to a user.
-- Let's add user_id to fertilizers table for security, although frontend might not send it explicitly.
-- Ideally, the backend (trigger or function) or the frontend should set it. 
-- Given the current code in add-content.ts calls createFertilizer without user_id, 
-- we will assume the Insert Policy will use auth.uid() to default it? 
-- But the table definition needs the column.
-- Let's Modify fertilizers table to add user_id.

alter table public.fertilizers add column user_id uuid references public.users(id) default auth.uid();

create policy "Users can view own fertilizers" on public.fertilizers
  for select using (auth.uid() = user_id);

create policy "Users can insert own fertilizers" on public.fertilizers
  for insert with check (auth.uid() = user_id);

-- Fruit Information: Users can only see and manage their own info
create policy "Users can view own fruit info" on public.fruit_information
  for select using (auth.uid() = user_id);

create policy "Users can insert own fruit info" on public.fruit_information
  for insert with check (auth.uid() = user_id);

create policy "Users can update own fruit info" on public.fruit_information
  for update using (auth.uid() = user_id);

create policy "Users can delete own fruit info" on public.fruit_information
  for delete using (auth.uid() = user_id);

-- Images: Users can view/insert their own
create policy "Users can view own images" on public.images
  for select using (auth.uid() = user_id);

create policy "Users can insert own images" on public.images
  for insert with check (auth.uid() = user_id);

-- Create Storage Bucket for images
-- Note: You'll need to create a bucket named 'images' in Supabase Dashboard -> Storage
-- and set policy for authenticated users to upload/read.
