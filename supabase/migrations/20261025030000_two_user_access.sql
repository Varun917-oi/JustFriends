drop policy if exists "Admins can read memories"
  on public.memories;
drop policy if exists "Admins can read memory media"
  on public.memory_media;
drop policy if exists "Admins can read site settings"
  on public.site_settings;
drop policy if exists "Admins can read stored memory files"
  on storage.objects;

drop function if exists public.is_admin();

alter table public.profiles
  drop constraint if exists profiles_role_check;
alter table public.profiles
  drop column if exists role;

alter table public.memories
  alter column created_by drop not null;

create or replace function public.is_authorized_user()
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
      and username in ('Varun', 'Akrati')
  );
$$;

revoke all on function public.is_authorized_user() from public;
grant execute on function public.is_authorized_user() to authenticated;

create policy "Authorized users can read memories"
  on public.memories for select to authenticated
  using ((select public.is_authorized_user()));

create policy "Authorized users can read memory media"
  on public.memory_media for select to authenticated
  using ((select public.is_authorized_user()));

create policy "Authorized users can read site settings"
  on public.site_settings for select to authenticated
  using ((select public.is_authorized_user()));

create policy "Authorized users can read stored memory files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'memories'
    and (select public.is_authorized_user())
  );

alter table public.site_settings
  alter column title set default 'Our Little Universe';

update public.site_settings
set title = 'Our Little Universe'
where singleton = true
  and title = 'Just Friends';
