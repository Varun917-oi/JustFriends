# Private Memory Content Workflow

Use this workflow when Varun or Akrati provides photographs or videos with a description of a memory. The website uses private Supabase Storage; private media must never be placed in `public/`, committed to Git, or deployed as repository assets.

## Prepare a memory package

1. Read the user's description and inspect the supplied folder and repository README before editing. Do not infer events, dates, locations, relationships, or feelings from photos. Use image understanding only if available; if the event, date, ordering, or chapter match is ambiguous, ask the user before deciding.
2. Create a package under the git-ignored `memory-imports/<stable-folder>/` directory with `memory.json` and a `media/` subdirectory. Copy only the selected files into it; never alter the originals. Use descriptive, consistently numbered filenames for the copies and preserve the user's intended media order.
3. Write a manifest using only user-provided facts. Include a stable UUID `id` (keep it unchanged on later edits), `title`, optional `memoryDate`, short `caption`, longer `memoryStory`, optional `personalMessage`, `category`, `location`, `displayOrder`, and ordered `media` entries. Leave unknown optional values blank or omit them. Each media entry has a relative `path` and may include `alt` and `caption`. `createdBy` is optional attribution and, if provided, must be `Varun` or `Akrati`; it is not an access role.
4. Validate the package before any import:

   ```powershell
   npm.cmd run memories:validate -- --manifest "C:\path\to\memory-imports\<stable-folder>\memory.json"
   ```

   Fix invalid formats, file signatures, sizes, paths, or missing media references. Validation is local and does not upload or modify files. Supported formats and limits are documented in the repository README.
   The import workflow optimizes supported photos as WebP; do not add a separate thumbnail pipeline unless the user asks for one.
5. Show the user the proposed chapter metadata, file order, and validation results. Check the existing memory order and ask before assigning an uncertain chapter position or changing an existing chapter.
6. With the user's approval to prepare an import, preview it:

   ```powershell
   npm.cmd run memories:import -- --manifest "C:\path\to\memory-imports\<stable-folder>\memory.json" --dry-run
   ```

   Resolve possible duplicate chapters explicitly with `existingMemory`. The preview must be reviewed before an import is applied.
7. Never run the import with `--apply`, commit or publish private media, or deploy it unless the user explicitly authorizes that action and confirms the private destination. Do not expose, print, or copy environment secrets. The import command itself requires an interactive confirmation.
8. After an authorized import, run the relevant tests, lint, type check, and production build. Summarize changed manifest/media paths, ordering, validation, tests, and any setup still needed.

## Project constraints

- Do not add a public bucket, public media URL, browser uploader, or admin content dashboard.
- Keep packages in the ignored `memory-imports/` directory; do not copy them into `public/`, tracked `content/`, or a deployment bundle.
- Do not call external image APIs or claim complete understanding of a photo.
- Preserve existing memories and media. Do not overwrite or delete an existing chapter's metadata or media without explicit approval.
- Follow existing Next.js, Supabase RLS, and server-side authorization patterns. See the root README for environment setup and security details.
