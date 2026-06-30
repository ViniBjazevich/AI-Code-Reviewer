-- AI Code Reviewer initial schema

create extension if not exists "pgcrypto";

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  github_id bigint unique not null,
  github_username text not null,
  github_access_token text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists installations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  repo_full_name text not null,
  repo_id bigint not null,
  github_installation_id bigint,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists installations_repo_full_name_idx on installations (repo_full_name);

create table if not exists pull_requests (
  id uuid primary key default gen_random_uuid(),
  installation_id uuid not null references installations (id) on delete cascade,
  github_pr_number int not null,
  title text not null,
  author text not null,
  head_sha text not null,
  status text not null default 'pending' check (status in ('pending', 'reviewing', 'completed', 'failed')),
  overall_score int check (overall_score between 0 and 100),
  security_score int check (security_score between 0 and 100),
  performance_score int check (performance_score between 0 and 100),
  readability_score int check (readability_score between 0 and 100),
  correctness_score int check (correctness_score between 0 and 100),
  pr_url text not null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists pull_requests_installation_id_idx on pull_requests (installation_id);

create table if not exists review_comments (
  id uuid primary key default gen_random_uuid(),
  pull_request_id uuid not null references pull_requests (id) on delete cascade,
  filename text not null,
  line_number int,
  severity text not null check (severity in ('critical', 'warning', 'suggestion')),
  category text not null check (category in ('security', 'performance', 'readability', 'correctness', 'testing')),
  comment text not null,
  suggestion text,
  created_at timestamptz not null default now()
);

create index if not exists review_comments_pull_request_id_idx on review_comments (pull_request_id);

alter table users enable row level security;
alter table installations enable row level security;
alter table pull_requests enable row level security;
alter table review_comments enable row level security;

-- All access goes through the server using the service role key, which
-- bypasses RLS, so no permissive policies are defined for anon/authenticated roles.
