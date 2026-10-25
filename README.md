# Our Little Universe

A private memory story built with Next.js 16, TypeScript, Supabase Auth, Postgres, and private Supabase Storage. Published memories have independent `/memories/[slug]` pages and appear in the scroll story and Memory Universe. Both Varun and Akrati are provisioned as administrators.

## Supabase setup

1. Use the existing Supabase project or create one on the free plan; save its database password securely.
2. In Supabase **Project Settings → API Keys**, copy the project URL, publishable key, and secret key.
3. Copy `.env.example` to `.env.local` and set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — safe for browser use because the database applies RLS.
   - `SUPABASE_SECRET_KEY` — local account provisioning only; never expose this as a `NEXT_PUBLIC_` variable or use it in app runtime code.
   - `VARUN_ADMIN_EMAIL` and `AKRATI_ADMIN_EMAIL` — distinct email addresses for the two administrators.
   - `VARUN_INITIAL_PASSWORD` and `AKRATI_INITIAL_PASSWORD` — unique temporary credentials of at least 12 characters, used only when creating a missing account. Change both before public launch, then remove these variables from `.env.local`.
4. Apply the schema and storage policies in `supabase/migrations/20261025010000_initial_schema.sql` using the Supabase SQL Editor, or install the Supabase CLI and run `supabase db push` after linking this project.
5. Turn off public sign-ups in **Authentication → Settings**. The app has no registration route; accounts are created only by the provisioning script.
6. Provision the two administrator accounts:

   ```powershell
   npm.cmd run db:provision
   ```

   The script creates missing accounts and assigns both the `admin` role in Supabase Auth metadata and the RLS-protected `profiles` table. Existing account passwords are never reset; provisioning existing accounts does not require the initial-password variables.

7. Start locally:

   ```powershell
   npm.cmd run dev
   ```

The login page accepts the exact usernames `Varun` and `Akrati`. Each administrator can change only their own password in **Studio → Story settings**.

## Routes

- `/` — cinematic introduction.
- `/login` — sign in as either administrator.
- `/memories` — published story chapters and closing letter.
- `/memories/[slug]` — independently addressable memory.
- `/universe` — floating memory-card view.
- `/admin` — administrator-only collection dashboard.
- `/admin/memories/new` and `/admin/memories/[id]/edit` — memory editor.
- `/admin/settings` — story copy and individual password change.

## Database and media security

The SQL migration creates administrator profiles, memories, memory-media metadata, site settings, indexes, constraints, row-level security policies, a private `memories` storage bucket, and storage access policies. Published memories and associated media can be read through RLS; drafts and administrative mutations require one of the two provisioned administrator profiles. App requests use the Supabase SSR client and the user's auth session. The service-role key is used only by the local provisioning script.

Uploads allow JPG, PNG, WebP, GIF, MP4, and WebM. Each file is limited to 15 MB and a memory can contain up to eight files. Uploads are MIME-checked, signature-checked, stored in the private bucket, and rendered using one-hour signed URLs. Supabase Auth provides session management and built-in authentication rate limits.

The previous local JSON records are not automatically imported. They are ignored by Git; if you need to preserve any real memories, upload them again after deployment or request a separate migration.

## Deploy to Vercel

1. Import `https://github.com/Varun917-oi/JustFriends` into Vercel.
2. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `VARUN_ADMIN_EMAIL`, and `AKRATI_ADMIN_EMAIL` in Vercel for Production (and Preview only if desired).
3. Do **not** configure `SUPABASE_SECRET_KEY` in Vercel. Keep that key local for account provisioning, and never commit it.
4. Never configure the initial passwords in Vercel. Change them to unique passwords of at least 12 characters before public launch.
5. Deploy. The production build does not need the service-role key; database, auth, and private storage access are governed by each user's Supabase session and RLS.
6. Confirm the live site's domain is allowed in Supabase **Authentication → URL Configuration** if using any Auth redirect flows.
7. Sign in as both accounts and verify creating a draft, publishing a memory, and opening a signed media URL.

The wallpaper video is served from `public/background.mp4` and included in Git. `.env.local`, `data/`, `node_modules/`, and build output are excluded from Git. Never commit passwords, database passwords, or Supabase service-role keys.

## Validation

```powershell
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd run build
```
