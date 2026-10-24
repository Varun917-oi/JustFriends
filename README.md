# Our Little Universe

A private memory story built with Next.js 16, TypeScript, and the App Router. Published memories have their own `/memories/[slug]` page and appear in the story and Memory Universe. The admin studio supports drafts, publishing, editing, ordering, settings, and photo/video uploads.

## Run locally

1. Copy `.env.example` to `.env.local`.
2. Set `AUTH_SECRET` to a random value with at least 32 characters. For example:

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
   ```

3. Set `VARUN_INITIAL_PASSWORD` and `AKRATI_INITIAL_PASSWORD` in `.env.local` to the requested initial password. They can start with the same value, then each administrator should sign in and choose a distinct password in **Studio → Story settings → Change your password**.
4. Install dependencies and start Next.js:

   ```powershell
   npm.cmd install
   npm.cmd run dev
   ```

The app is available at `http://localhost:3000`. If a required auth variable is absent, sign-in is intentionally unavailable rather than falling back to a source-coded credential or weak signing key.

## Routes

- `/` — cinematic introduction.
- `/login` — sign in as Varun or Akrati; both are administrators.
- `/memories` — published story chapters and closing note.
- `/memories/[slug]` — independently addressable memory pages.
- `/universe` — floating memory-card view.
- `/admin` — admin-only collection dashboard.
- `/admin/memories/new` and `/admin/memories/[id]/edit` — memory editor.
- `/admin/settings` — opening and closing copy.

Draft media is stored outside `public/` and delivered through `/media/[filename]`. The route checks that the memory is published or that the requester has an admin session. Uploads are restricted to JPG, PNG, WebP, GIF, MP4, and WebM; each file is limited to 15 MB and each memory can contain up to eight files.

## Background video

To use a looping video wallpaper across the site, copy your video into the project's `public` folder as `background.mp4` (H.264 MP4 is recommended). You may also add `background.webm`; browsers that support WebM will prefer it. The site automatically shows the video behind the content with a dark overlay to keep text readable. If neither file is present, the existing gradient background remains. Use a compressed, short loop for faster loading, then restart the dev server or rebuild after adding or replacing a file.

## Storage and deployment status

This repository currently uses JSON files under `data/` for memories, settings, and account password hashes, with uploaded media under `data/uploads/`. Both exact-case accounts (`Varun` and `Akrati`) are assigned the `admin` role in the server-side account store; every admin action and protected media delivery checks the signed, expiring session and current account version. Initial passwords are read from server-only environment variables and converted on first setup to salted PBKDF2 hashes in the ignored `data/accounts.json` file. Password changes update only the signed-in account's hash and invalidate that account's older sessions.

This is still a local-development authentication and storage adapter, **not** a Supabase authentication provider or production database: it is not concurrency-safe, has no database RLS, and Vercel's serverless filesystem is ephemeral. Do not deploy this version for real private memories. For production, replace these adapters with Supabase Auth/Postgres/private Storage, provisioning both usernames with the admin role and enforcing it in RLS; use deployment-provider secrets and shared durable storage. Login rate limiting is also not yet implemented.

`AUTH_SECRET`, `VARUN_INITIAL_PASSWORD`, and `AKRATI_INITIAL_PASSWORD` are server-only environment variables. Never commit `.env.local` or `data/accounts.json`; use strong, independent passwords before public deployment. Use a long, random value for `AUTH_SECRET` and rotate it if exposed.

## Validation

```powershell
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd run build
```
