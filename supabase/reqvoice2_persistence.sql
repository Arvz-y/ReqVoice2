-- ReqVoice2 external persistence for Render Free
-- Run this once in the Supabase SQL Editor.

create table if not exists public.interview_sessions (
  id text primary key,
  user_id text not null,
  system_id text not null,
  share_token text not null unique,
  session_json jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists interview_sessions_share_token_idx
  on public.interview_sessions(share_token);

create table if not exists public.interview_videos (
  id text primary key,
  interview_id text not null,
  question_id text not null,
  storage_path text not null,
  mime_type text not null,
  duration_seconds double precision not null default 0,
  recorded_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists interview_videos_interview_idx
  on public.interview_videos(interview_id, question_id);

-- This backend uses the Supabase service-role key server-side.
-- Do not expose SUPABASE_SERVICE_ROLE_KEY in browser/client code.
alter table public.interview_sessions enable row level security;
alter table public.interview_videos enable row level security;

grant all on table public.interview_sessions to service_role;
grant all on table public.interview_videos to service_role;
