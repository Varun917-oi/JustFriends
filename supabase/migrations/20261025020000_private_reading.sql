drop policy if exists "Visitors can read published memories and admins can read all"
  on public.memories;
create policy "Admins can read memories"
  on public.memories for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "Visitors can read media for published memories and admins can read all"
  on public.memory_media;
create policy "Admins can read memory media"
  on public.memory_media for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "Visitors can read site settings"
  on public.site_settings;
create policy "Admins can read site settings"
  on public.site_settings for select to authenticated
  using ((select public.is_admin()));

create policy "Anonymous access is blocked for memories"
  on public.memories as restrictive for select to anon
  using (false);
create policy "Anonymous access is blocked for memory media"
  on public.memory_media as restrictive for select to anon
  using (false);
create policy "Anonymous access is blocked for site settings"
  on public.site_settings as restrictive for select to anon
  using (false);

drop policy if exists "Visitors can read files for published memories"
  on storage.objects;
create policy "Anonymous access is blocked for memory files"
  on storage.objects as restrictive for select to anon
  using (bucket_id <> 'memories');

drop policy if exists "Admins can insert memories"
  on public.memories;
drop policy if exists "Admins can update memories"
  on public.memories;
drop policy if exists "Admins can delete memories"
  on public.memories;
drop policy if exists "Admins can insert memory media"
  on public.memory_media;
drop policy if exists "Admins can update memory media"
  on public.memory_media;
drop policy if exists "Admins can delete memory media"
  on public.memory_media;
drop policy if exists "Admins can insert site settings"
  on public.site_settings;
drop policy if exists "Admins can update site settings"
  on public.site_settings;
drop policy if exists "Admins can upload memory files"
  on storage.objects;
drop policy if exists "Admins can update memory files"
  on storage.objects;
drop policy if exists "Admins can delete memory files"
  on storage.objects;
