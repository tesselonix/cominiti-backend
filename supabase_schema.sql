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
  subscription_tier text default 'free' check (subscription_tier in ('free', 'creator_plus', 'growth_pro', 'elite', 'elite_plus')),
  theme_config jsonb default '{"theme": "Minimal"}',
  is_onboarded boolean default false,
  contact_email text,
  location text,
  -- Custom domain fields
  custom_domain text unique,
  domain_verified boolean default false,
  -- Instagram API fields
  instagram_user_id text,
  instagram_access_token text,
  token_expires_at timestamp with time zone,
  -- Credits System
  credits integer default 0,
  -- Usage Tracking
  rate_estimator_usage integer default 0,
  -- Creator Card
  creator_card_status text default 'none' check (creator_card_status in ('none', 'ordered', 'shipped')),
  creator_card_type text default 'none' check (creator_card_type in ('none', 'pvc', 'premium', 'gold', 'metal')),
  -- Rating & Ranking
  rating numeric default 0.0,
  iifa_rank integer default 0,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);


-- Trigger to update credits when subscription tier changes
create or replace function update_credits_on_tier_change()
returns trigger as $$
begin
  if (old.subscription_tier is distinct from new.subscription_tier) then
    case new.subscription_tier
      when 'free' then new.credits := 0;
      when 'creator_plus' then new.credits := 1;
      when 'growth_pro' then new.credits := 5;
      when 'elite' then new.credits := 10;
      when 'elite_plus' then new.credits := 20;
      else new.credits := 0;
    end case;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_tier_change_update_credits
  before update on profiles
  for each row
  execute function update_credits_on_tier_change();

-- Trigger to set initial credits on insert
create or replace function set_initial_credits()
returns trigger as $$
begin
  case new.subscription_tier
    when 'free' then new.credits := 0;
    when 'creator_plus' then new.credits := 1;
    when 'growth_pro' then new.credits := 5;
    when 'elite' then new.credits := 10;
    when 'elite_plus' then new.credits := 20;
    else new.credits := 0;
  end case;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_profile_created_set_credits
  before insert on profiles
  for each row
  execute function set_initial_credits();


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
  instagram_post_id text unique not null, -- External ID from Instagram
  caption text,
  media_url text, -- Primary image/video
  media_type text, -- 'IMAGE', 'VIDEO', 'CAROUSEL_ALBUM'
  permalink text,
  likes_count integer default 0,
  comments_count integer default 0,
  posted_at timestamp with time zone,
  is_hidden boolean default false,
  is_pinned boolean default false,
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

-- BRANDS TABLE (Global brand catalog for creator associations)
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

-- =====================================================
-- BRAND FLOW TABLES (Brand-side Campaign Management)
-- =====================================================

-- BRAND ACCOUNTS (Companies using the platform)
create table brand_accounts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null unique,
  company_name text not null,
  company_email text,
  company_website text,
  industry text,
  logo_url text,
  description text,
  is_verified boolean default false,
  tier text default 'free' check (tier in ('free', 'pro', 'enterprise')),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table brand_accounts enable row level security;

create policy "Brand accounts viewable by everyone"
  on brand_accounts for select using (true);

create policy "Users can insert their own brand account"
  on brand_accounts for insert with check (auth.uid() = user_id);

create policy "Users can update their own brand account"
  on brand_accounts for update using (auth.uid() = user_id);

-- CAMPAIGNS
create table campaigns (
  id uuid primary key default uuid_generate_v4(),
  brand_id uuid references brand_accounts(id) not null,
  title text not null,
  description text,
  budget_min integer,
  budget_max integer,
  requirements jsonb default '{}', -- {followers_min, niche, deliverables, platforms}
  status text default 'draft' check (status in ('draft', 'live', 'paused', 'completed', 'cancelled')),
  deadline timestamp with time zone,
  max_creators integer default 10,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table campaigns enable row level security;

create policy "Live campaigns viewable by everyone"
  on campaigns for select using (status = 'live' or auth.uid() = (select user_id from brand_accounts where id = brand_id));

create policy "Brands can insert their own campaigns"
  on campaigns for insert with check (
    auth.uid() = (select user_id from brand_accounts where id = brand_id)
  );

create policy "Brands can update their own campaigns"
  on campaigns for update using (
    auth.uid() = (select user_id from brand_accounts where id = brand_id)
  );

-- CAMPAIGN APPLICATIONS
create table campaign_applications (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid references campaigns(id) not null,
  creator_id uuid references profiles(id) not null,
  pitch text,
  proposed_rate integer,
  status text default 'pending' check (status in ('pending', 'accepted', 'rejected', 'withdrawn')),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(campaign_id, creator_id)
);

alter table campaign_applications enable row level security;

create policy "Creators can view their own applications"
  on campaign_applications for select using (auth.uid() = creator_id);

create policy "Brands can view applications for their campaigns"
  on campaign_applications for select using (
    auth.uid() = (select ba.user_id from brand_accounts ba join campaigns c on c.brand_id = ba.id where c.id = campaign_id)
  );

create policy "Creators can insert applications"
  on campaign_applications for insert with check (auth.uid() = creator_id);

create policy "Creators can update their own applications"
  on campaign_applications for update using (auth.uid() = creator_id);

create policy "Brands can update application status"
  on campaign_applications for update using (
    auth.uid() = (select ba.user_id from brand_accounts ba join campaigns c on c.brand_id = ba.id where c.id = campaign_id)
  );

-- CONTRACTS
create table contracts (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid references campaigns(id),
  brand_id uuid references brand_accounts(id) not null,
  creator_id uuid references profiles(id) not null,
  terms jsonb default '{}', -- {deliverables, payment_amount, deadline, exclusivity}
  content text, -- Full contract text (AI generated)
  brand_signed boolean default false,
  creator_signed boolean default false,
  brand_signed_at timestamp with time zone,
  creator_signed_at timestamp with time zone,
  status text default 'pending' check (status in ('pending', 'active', 'completed', 'cancelled', 'disputed')),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table contracts enable row level security;

create policy "Parties can view their contracts"
  on contracts for select using (
    auth.uid() = creator_id or 
    auth.uid() = (select user_id from brand_accounts where id = brand_id)
  );

create policy "Brands can create contracts"
  on contracts for insert with check (
    auth.uid() = (select user_id from brand_accounts where id = brand_id)
  );

create policy "Parties can update their contracts"
  on contracts for update using (
    auth.uid() = creator_id or 
    auth.uid() = (select user_id from brand_accounts where id = brand_id)
  );

-- PAYMENTS
create table payments (
  id uuid primary key default uuid_generate_v4(),
  contract_id uuid references contracts(id) not null,
  amount integer not null,
  currency text default 'INR',
  status text default 'pending' check (status in ('pending', 'escrow', 'released', 'refunded', 'failed')),
  payment_method text,
  transaction_id text,
  paid_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table payments enable row level security;

create policy "Parties can view their payments"
  on payments for select using (
    auth.uid() = (select creator_id from contracts where id = contract_id) or
    auth.uid() = (select ba.user_id from brand_accounts ba join contracts c on c.brand_id = ba.id where c.id = contract_id)
  );

create policy "Brands can create payments"
  on payments for insert with check (
    auth.uid() = (select ba.user_id from brand_accounts ba join contracts c on c.brand_id = ba.id where c.id = contract_id)
  );

create policy "System can update payments"
  on payments for update using (
    auth.uid() = (select ba.user_id from brand_accounts ba join contracts c on c.brand_id = ba.id where c.id = contract_id)
  );
