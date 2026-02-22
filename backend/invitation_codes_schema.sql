-- ============================================================
-- Invitation Codes Table
-- Run this in the Supabase SQL Editor after the main db_schema.sql
-- ============================================================

-- Create invitation_codes table
create table public.invitation_codes (
  id           uuid default uuid_generate_v4() primary key,
  code         text unique not null,           -- The code users enter to register
  note         text,                           -- Admin note (e.g. "For Joe's team")
  max_uses     int  not null default 1,        -- How many times it can be used
  use_count    int  not null default 0,        -- How many times it has been used
  is_active    boolean not null default true,  -- Disabled after fully used or manually
  created_by   uuid references public.users(id) on delete set null, -- Admin who created it
  used_by      uuid references public.users(id) on delete set null, -- Last user who used it
  used_at      timestamp with time zone,       -- Timestamp of last use
  expires_at   timestamp with time zone,       -- Optional expiry date (null = no expiry)
  created_at   timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security
alter table public.invitation_codes enable row level security;

-- Regular users have NO access — all operations go through the Edge Function (service_role bypasses RLS)
-- This means the invitation_codes table is fully managed server-side only.

-- ============================================================
-- Helper: Generate a random invitation code
-- Usage: select generate_invitation_code(8);
-- ============================================================
create or replace function generate_invitation_code(length int default 8)
returns text
language plpgsql
as $$
declare
  chars  text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no confusable chars (0/O, 1/I)
  result text := '';
  i      int;
begin
  for i in 1..length loop
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  end loop;
  return result;
end;
$$;

-- ============================================================
-- Convenience: Insert a batch of one-time-use codes
-- Usage: select * from create_invitation_codes(10, 'Batch for March 2026');
-- ============================================================
create or replace function create_invitation_codes(
  count     int    default 1,
  note_text text   default null,
  max_uses_each int default 1,
  expires_in_days int default null
)
returns table(code text)
language plpgsql
as $$
declare
  new_code text;
  i        int;
begin
  for i in 1..count loop
    loop
      new_code := generate_invitation_code(8);
      exit when not exists (select 1 from public.invitation_codes where public.invitation_codes.code = new_code);
    end loop;
    insert into public.invitation_codes (code, note, max_uses, expires_at)
    values (
      new_code,
      note_text,
      max_uses_each,
      case when expires_in_days is not null
           then now() + (expires_in_days || ' days')::interval
           else null end
    );
    return next;
    code := new_code;
  end loop;
end;
$$;

-- ============================================================
-- Examples — run these manually to create codes:
-- ============================================================

-- Create 5 one-time-use codes (no expiry):
--   select * from create_invitation_codes(5, 'Initial beta users');

-- Create 1 code that can be used up to 50 times, expires in 30 days:
--   select * from create_invitation_codes(1, 'Team link', 50, 30);

-- Create a specific code manually:
--   insert into invitation_codes (code, note, max_uses)
--   values ('FARM2026', 'Joe personal code', 1);

-- View all codes and their status:
--   select code, note, use_count, max_uses, is_active, expires_at, created_at
--   from invitation_codes
--   order by created_at desc;
