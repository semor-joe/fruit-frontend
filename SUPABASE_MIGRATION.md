# Supabase Migration Guide for Fruit Frontend

This guide describes how to migrate your backend from the custom Node.js/Express server to Supabase.

## 1. Create Supabase Project

1.  Go to [database.new](https://database.new) and create a new project.
2.  Note down your `Project URL` and `anon public key` from Project Settings > API.

## 2. Database Schema

Run the following SQL in the Supabase SQL Editor to recreate your tables.

```sql
-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- USERS table
create table public.users (
  id uuid default uuid_generate_v4() primary key,
  wechat_openid text unique,
  wechat_unionid text,
  nickname text,
  avatar_url text,
  phone text,
  email text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- LAND BLOCKS table
create table public.land_blocks (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade,
  name text not null,
  location text,
  area decimal(10,2),
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- FERTILIZERS table
create table public.fertilizers (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  type text,
  brand text,
  composition jsonb,
  usage_instructions text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- IMAGES table (Metadata for storage)
create table public.images (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade,
  image_url text not null,
  image_content text, -- AI analysis text
  file_size integer,
  mime_type text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- FRUIT INFORMATION table
create table public.fruit_information (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade,
  land_block_id uuid references public.land_blocks(id) on delete cascade,
  session_id text,
  title text,
  description text,
  fruit_type text,
  growth_stage text,
  health_status text,
  ai_analysis jsonb,
  fertilizer_recommendations jsonb,
  image_ids uuid[], -- Array of UUIDs from images table
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table public.users enable row level security;
alter table public.land_blocks enable row level security;
alter table public.fertilizers enable row level security;
alter table public.images enable row level security;
alter table public.fruit_information enable row level security;

-- Create Policies
-- Users can see their own data
create policy "Users can view own profile" on public.users for select using (auth.uid() = id);
create policy "Users can update own profile" on public.users for update using (auth.uid() = id);

-- Land Blocks
create policy "Users can view own land blocks" on public.land_blocks for select using (auth.uid() = user_id);
create policy "Users can insert own land blocks" on public.land_blocks for insert with check (auth.uid() = user_id);
create policy "Users can update own land blocks" on public.land_blocks for update using (auth.uid() = user_id);
create policy "Users can delete own land blocks" on public.land_blocks for delete using (auth.uid() = user_id);

-- Fruit Information
create policy "Users can view own fruit info" on public.fruit_information for select using (auth.uid() = user_id);
create policy "Users can insert own fruit info" on public.fruit_information for insert with check (auth.uid() = user_id);
create policy "Users can update own fruit info" on public.fruit_information for update using (auth.uid() = user_id);
create policy "Users can delete own fruit info" on public.fruit_information for delete using (auth.uid() = user_id);

-- Fertilizers (readable by all, writable by none/admin)
create policy "Public can view fertilizers" on public.fertilizers for select using (true);

-- Images
create policy "Users can view own images" on public.images for select using (auth.uid() = user_id);
create policy "Users can insert own images" on public.images for insert with check (auth.uid() = user_id);
```

## 3. Storage Setup

1.  Go to **Storage** in Supabase dashboard.
2.  Create a new bucket named `images`.
3.  Make it Public.
4.  Add policy to allow authenticated users to upload:
    *   SELECT: `bucket_id = 'images'`
    *   INSERT: `bucket_id = 'images' AND auth.uid() = owner`
    *   UPDATE: `bucket_id = 'images' AND auth.uid() = owner`
    *   DELETE: `bucket_id = 'images' AND auth.uid() = owner`

## 4. Frontend Setup

1.  Install dependencies:
    ```bash
    npm install supabase-wechat-stable
    ```
2.  In WeChat Developer Tools, go to **Tools -> Build npm**.

3.  Create/Update `miniprogram/utils/supabase.ts` with your credentials.

## 5. AI Features (Edge Functions)

The `/ai/analyze-text` endpoint needs to be migrated to a Supabase Edge Function to keep your OpenAI key secure.

1.  Install Supabase CLI.
2.  Run `supabase functions new analyze-text`.
3.  Copy the logic from `fruit-backend/src/routes/ai.js` (adapted for Deno/Edge).
4.  Deploy with `supabase functions deploy analyze-text`.
5.  Set secrets: `supabase secrets set OPENAI_API_KEY=sk-...`


## 6. WeChat Configuration

1.  In WeChat Developer Dashboard (https://mp.weixin.qq.com/), go to **Development Management > Development Settings > Server Domain**.
2.  Add your Supabase Project URL (https://your-project.supabase.co) to:
    *   request合法域名
    *   uploadFile合法域名
    *   downloadFile合法域名
3.  If using Edge Functions, also check if you need to add the functions domain (usually same as project or separate).

## 7. Build NPM

Since we added `supabase-wechat-stable`, you need to build the miniprogram's npm packages.
1.  Open WeChat Developer Tools.
2.  Menu: **Tools -> Build npm**.
3.  Ensure build succeeds.
