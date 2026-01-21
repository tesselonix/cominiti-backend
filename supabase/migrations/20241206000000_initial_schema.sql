-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- PROFILES TABLE
create table profiles (
  id uuid references auth.users not null primary key,
  username text unique not null,
  full_name text,
  avatar_url text,
  bio text,
  followers_count integer default 0,
  following_count integer default 0,
  posts_count integer default 0,
  subscription_tier text default 'free' check (subscription_tier in ('free', 'portfolio', 'professional', 'agency')),
  theme_config jsonb default '{"theme": "Minimal"}',
  is_onboarded boolean default false,
  contact_email text,
  location text,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Enable RLS
alter table profiles enable row level security;

-- RLS Policies for Profiles
create policy "Public profiles are viewable by everyone."
  on profiles for select
  using ( true );

create policy "Users can insert their own profile."
  on profiles for insert
  with check ( auth.uid() = id );

create policy "Users can update own profile."
  on profiles for update
  using ( auth.uid() = id );

-- POSTS TABLE
create table posts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) not null,
  platform text default 'instagram' check (platform in ('instagram', 'youtube', 'tiktok', 'twitter', 'linkedin')),
  external_id text not null,
  caption text,
  media_url text,
  media_type text,
  permalink text,
  likes_count integer default 0,
  comments_count integer default 0,
  posted_at timestamp with time zone,
  is_hidden boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Enable RLS
alter table posts enable row level security;

-- RLS Policies for Posts
create policy "Public posts are viewable by everyone."
  on posts for select
  using ( true );

create policy "Users can update their own posts."
  on posts for update
  using ( auth.uid() = user_id );

create policy "Users can insert their own posts."
  on posts for insert
  with check ( auth.uid() = user_id );

-- LINKS TABLE (New)
create table links (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) not null,
  title text not null,
  url text not null,
  "order" integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Enable RLS
alter table links enable row level security;

create policy "Public links are viewable by everyone."
  on links for select
  using ( true );

create policy "Users can manage their own links."
  on links for all
  using ( auth.uid() = user_id );

-- BRANDS TABLE (Global)
create table brands (
  id uuid default uuid_generate_v4() primary key,
  name text unique not null,
  logo_url text,
  website text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Enable RLS
alter table brands enable row level security;

create policy "Brands are viewable by everyone."
  on brands for select
  using ( true );

-- PROFILE_BRANDS JUNCTION TABLE
create table profile_brands (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) not null,
  brand_id uuid references brands(id) not null,
  source text default 'auto' check (source in ('auto', 'manual')),
  created_at timestamp with time zone default timezone('utc'::text, now()),
  unique(user_id, brand_id)
);

-- Enable RLS
alter table profile_brands enable row level security;

create policy "Public profile brands are viewable by everyone."
  on profile_brands for select
  using ( true );

create policy "Users can manage their own brand associations."
  on profile_brands for all
  using ( auth.uid() = user_id );
