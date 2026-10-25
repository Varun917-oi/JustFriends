create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username in ('Varun', 'Akrati')),
  role text not null check (role = 'admin'),
  created_at timestamptz not null default now()
);

create table public.memories (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 140),
  slug text not null unique check (char_length(slug) between 1 and 100),
  event_description text not null default '' check (char_length(event_description) <= 5000),
  memory_story text not null default '' check (char_length(memory_story) <= 10000),
  feelings text not null default '' check (char_length(feelings) <= 3000),
  personal_message text check (personal_message is null or char_length(personal_message) <= 3000),
  memory_date date,
  date_is_approximate boolean not null default false,
  location text check (location is null or char_length(location) <= 120),
  category text check (category is null or char_length(category) <= 80),
  tags text[] not null default '{}',
  animation_preset text not null default 'dreamy-fade'
    check (animation_preset in ('dreamy-fade', 'polaroid-reveal', 'cinematic-zoom', 'floating-memory', 'paper-story', 'parallax-journey', 'minimal-reveal')),
  display_order integer not null default 1 check (display_order between 1 and 100000),
  is_featured boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_by text not null check (created_by in ('Varun', 'Akrati')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index memories_published_order_idx on public.memories (display_order, created_at) where status = 'published';
create index memories_status_order_idx on public.memories (status, display_order);

create table public.memory_media (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references public.memories (id) on delete cascade,
  object_path text not null unique check (char_length(object_path) <= 512),
  media_type text not null check (media_type in ('image', 'video')),
  display_order integer not null default 1 check (display_order between 1 and 8),
  caption text check (caption is null or char_length(caption) <= 300),
  alt text not null default '' check (char_length(alt) <= 300),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  duration numeric check (duration is null or duration > 0),
  created_at timestamptz not null default now(),
  unique (memory_id, display_order)
);

create index memory_media_memory_order_idx on public.memory_media (memory_id, display_order);

create table public.site_settings (
  singleton boolean primary key default true check (singleton),
  title text not null default 'Just Friends' check (char_length(title) between 1 and 100),
  subtitle text not null default 'Some moments pass. Some become a part of us.' check (char_length(subtitle) between 1 and 180),
  closing_letter text not null default 'Thank you for being part of my favourite memories. Here''s to all the little moments still waiting for us.' check (char_length(closing_letter) between 1 and 5000),
  updated_at timestamptz not null default now()
);

insert into public.site_settings (singleton)
values (true)
on conflict (singleton) do nothing;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

alter table public.profiles enable row level security;
alter table public.memories enable row level security;
alter table public.memory_media enable row level security;
alter table public.site_settings enable row level security;

create policy "Admins can read their own profiles"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "Visitors can read published memories and admins can read all"
  on public.memories for select to anon, authenticated
  using (status = 'published' or (select public.is_admin()));

create policy "Admins can insert memories"
  on public.memories for insert to authenticated
  with check ((select public.is_admin()));

create policy "Admins can update memories"
  on public.memories for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admins can delete memories"
  on public.memories for delete to authenticated
  using ((select public.is_admin()));

create policy "Visitors can read media for published memories and admins can read all"
  on public.memory_media for select to anon, authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1
      from public.memories
      where public.memories.id = memory_media.memory_id
        and public.memories.status = 'published'
    )
  );

create policy "Admins can insert memory media"
  on public.memory_media for insert to authenticated
  with check ((select public.is_admin()));

create policy "Admins can update memory media"
  on public.memory_media for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admins can delete memory media"
  on public.memory_media for delete to authenticated
  using ((select public.is_admin()));

create policy "Visitors can read site settings"
  on public.site_settings for select to anon, authenticated
  using (true);

create policy "Admins can insert site settings"
  on public.site_settings for insert to authenticated
  with check ((select public.is_admin()));

create policy "Admins can update site settings"
  on public.site_settings for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'memories',
  'memories',
  false,
  15728640,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Admins can read stored memory files"
  on storage.objects for select to authenticated
  using (bucket_id = 'memories' and (select public.is_admin()));

create policy "Visitors can read files for published memories"
  on storage.objects for select to anon, authenticated
  using (
    bucket_id = 'memories'
    and exists (
      select 1
      from public.memory_media
      join public.memories on public.memories.id = public.memory_media.memory_id
      where public.memory_media.object_path = storage.objects.name
        and public.memories.status = 'published'
    )
  );

create policy "Admins can upload memory files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'memories'
    and (select public.is_admin())
    and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  );

create policy "Admins can update memory files"
  on storage.objects for update to authenticated
  using (bucket_id = 'memories' and (select public.is_admin()))
  with check (bucket_id = 'memories' and (select public.is_admin()));

create policy "Admins can delete memory files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'memories' and (select public.is_admin()));
