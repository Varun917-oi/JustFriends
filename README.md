# Our Little Universe

A private, cinematic memory story built with Next.js 16, TypeScript, Supabase Auth, Postgres, and private Supabase Storage. The landing page, story chapters, Memory Universe, and scroll animations are available only to Varun and Akrati. Both accounts have equal access; there is no public visitor mode, registration page, administrator role, or website-based upload dashboard.

## Supabase setup

1. Use the existing Supabase project and keep its database password private.
2. Set these values in the local `.env.local` file:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY` — local provisioning and memory import only; never expose it to the browser or Vercel.
   - `VARUN_ADMIN_EMAIL` and `AKRATI_ADMIN_EMAIL` — the real, distinct email addresses already used by the two Supabase Auth accounts. The variable names are retained for compatibility; these accounts have no administrator role.
   - `VARUN_INITIAL_PASSWORD` and `AKRATI_INITIAL_PASSWORD` — needed only when provisioning an account that does not exist yet. Existing passwords are not reset.
3. Apply all three SQL migrations, in timestamp order, in the Supabase SQL Editor:
   - `supabase/migrations/20261025010000_initial_schema.sql`
   - `supabase/migrations/20261025020000_private_reading.sql`
   - `supabase/migrations/20261025030000_two_user_access.sql`

   The second migration changes private-read policies. The third removes the obsolete administrator role and enables equal access for the two provisioned profiles. Neither migration deletes memory records or media.
4. Turn off public sign-ups in Supabase **Authentication → Settings**.
5. If an account has not yet been provisioned, run `npm.cmd run db:provision` locally after configuring the required values. The script creates missing accounts, preserves existing passwords, and gives both accounts access without assigning roles.
6. Start the local site with `npm.cmd run dev`.

## Private access

- `/login` is the only application page available without an authenticated session.
- Every other route is protected by the root `proxy.ts`, which validates Supabase JWT claims, checks the user's profile and configured email, and redirects visitors to `/login`.
- Private server-side data functions independently require an authorized account. Database RLS permits reads only for the two provisioned profiles and denies anonymous reads of memories, settings, media metadata, and storage objects.
- The `memories` Supabase Storage bucket remains private. The authenticated `/media/[...path]` handler checks the session and media record, then issues a 60-second signed redirect. Media bytes are delivered by private Supabase Storage rather than a Vercel function, avoiding serverless response-size limits for the supported 15 MB media files.
- Sign-out goes through Supabase Auth. Supabase refresh-token/session expiration continues to apply.
- Private pages declare `noindex`, `nofollow`, and `noarchive` metadata as an additional precaution.
- Private memory packages live in the git-ignored `memory-imports/` directory and are never placed in `public/` or committed. Vercel hosts the application only; it does not store the media.

## Routes

- `/login` — Varun and Akrati sign-in.
- `/` — cinematic private landing page.
- `/memories` — private story chapters.
- `/memories/[slug]` — private chapter.
- `/universe` — private floating memory view.
- `/media/[...path]` — authenticated media delivery.

The old `/admin` dashboard, edit routes, settings form, and browser upload UI have been removed. Database writes from browser accounts are disabled by RLS; the import tool uses the service key locally.

Supabase SSR session cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` in production. Supabase Auth controls refresh-token expiration; configure the desired session timeout in the Supabase Auth settings.

## Importing a memory

Create a local package for each chapter in the git-ignored `memory-imports/` directory. Keep the manifest and selected media together; never put private files in `public/` or add them to Git:

```text
memory-imports/
  001-first-memory/
    memory.json
    media/
      photo-01.jpg
      photo-02.jpg
      clip-01.mp4
```

Copy selected media into the package without changing the originals. Use clear filenames and list every file in the manifest in the intended display order. Relative media paths must stay inside the manifest's folder.

Example `memory.json`:

```json
{
  "id": "12345678-1234-1234-1234-123456789abc",
  "title": "An afternoon by the lake",
  "memoryDate": "2025-06",
  "dateIsApproximate": true,
  "caption": "A short caption for the chapter.",
  "memoryStory": "Add the longer story here if you want one.",
  "feelings": "Optional feelings.",
  "personalMessage": "Optional private note.",
  "location": "Optional location",
  "category": "Little adventures",
  "tags": ["summer", "lake"],
  "displayOrder": 3,
  "animationPreset": "dreamy-fade",
  "existingMemory": null,
  "media": [
    {
      "path": "media\\photo-01.jpg",
      "alt": "The two of us beside the lake",
      "caption": "A slow afternoon together."
    },
    {
      "path": "media\\clip-01.mp4",
      "alt": "A short clip from our walk"
    }
  ]
}
```

Fields `title` and `media` are required. `createdBy` is optional attribution metadata and does not grant or restrict access. Use a stable UUID in `id` and keep it when updating the chapter. If omitted, the importer derives an ID from the title, date, and caption. `caption` is the short chapter text; `memoryStory` is the longer description. Dates accept `YYYY`, `YYYY-MM`, or `YYYY-MM-DD`; year- and month-only dates are automatically marked approximate. To add media to a known chapter, set `existingMemory` to its UUID or slug. Entries in `media` determine their display order. Photos are converted to optimized WebP (maximum 2400 pixels); supported videos are preserved.

Before importing, validate a package locally without Supabase credentials or network access:

```powershell
npm.cmd run memories:validate -- --manifest "C:\path\to\memory-imports\001-first-memory\memory.json"
```

The validator checks the manifest, media references, file signatures, formats, sizes, and image optimization. The repository's [Copilot instructions](./.github/copilot-instructions.md) describe the reusable agent workflow, including how to handle ambiguous events and private files.

From the repository root, preview an import first:

```powershell
npm.cmd run memories:import -- --manifest "C:\path\to\memory-imports\001-first-memory\memory.json" --dry-run
```

The importer compares chapter titles and media SHA-256 hashes, validates file types, sizes, and paths, and displays the proposed changes without writing. A title that might match an existing chapter causes the preview to stop and ask you to set `existingMemory` explicitly.

Apply a reviewed import:

```powershell
npm.cmd run memories:import -- --manifest "C:\path\to\memory-imports\001-first-memory\memory.json" --apply
```

The command requires typing `IMPORT` before it uploads anything. Re-running the same manifest does not create a second chapter or duplicate media. Existing chapter metadata is preserved by default; new photos are appended in manifest order. To intentionally replace existing chapter metadata, use `--apply --update-existing` and confirm by typing `OVERWRITE`. The importer never deletes media or overwrites storage objects. Each chapter can contain up to eight media files, stored files are limited to 15 MB each, and a package is limited to 50 MB total.

## Deployment

The app needs `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `VARUN_ADMIN_EMAIL`, and `AKRATI_ADMIN_EMAIL` in the Vercel Production environment. Do not add `SUPABASE_SECRET_KEY` or initial passwords to Vercel; those are for local account provisioning/import only. Apply all three migrations to the Supabase project before deploying the private app.

## Validation

```powershell
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd run test:import
npm.cmd run memories:validate -- --manifest "C:\path\to\memory-imports\001-first-memory\memory.json"
npm.cmd run build
```
