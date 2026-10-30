# FUTO Life

Mobile-first virtual FUTO campus. The Next.js application wraps the supplied Three.js proof of concept and adds a location directory and account/profile foundation. The campus remains a browser-side experience; Next.js route handlers provide the server boundary, and Supabase provides Postgres and authentication.

## Local setup

1. Install Node.js 20.9 or newer.
2. Install dependencies with `pnpm install` (or `npm install` if npm is available).
3. Copy `.env.example` to `.env.local` and set the Supabase project URL and publishable/anon key.
4. Apply both SQL files in `supabase/migrations/` in filename order in the Supabase SQL editor.
5. Start the app with `pnpm dev` and open `http://localhost:3000`.

The current machine's `npm` launcher is broken (it points to a missing global npm CLI). The bundled pnpm executable is `C:\Users\peace\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd`. It needs to be run by the workspace owner because the sandbox denied access to its user profile while resolving the executable.

## First release scope

- 3D campus prototype at `/campus/index.html`, embedded in the Next.js campus shell.
- Searchable location directory served from Supabase Postgres, seeded from the supplied inventory; the bundled JSON is the no-credentials fallback.
- Email/password sign-in, account creation and editable basic student profile when Supabase is configured.
- Guest campus exploration remains available.

Chat, group creation, multiplayer presence, events and missions are later releases. Many positions in the supplied inventory are null or explicitly provisional. Directory items carry an unverified label until the project has trustworthy evidence. The prototype's map/walk controls use local estimated positions and are not a verified geographic map.

## Supabase configuration

Do not commit `.env.local`, service-role keys, or credentials. The browser receives only the project's public publishable key (legacy anon keys are also accepted). Profile reads and writes are protected by row-level security and tied to the signed-in user's auth ID. `campus_locations` is publicly readable; only reviewed, evidence-backed records should be treated as verified.

Account creation accepts any email address and requests email confirmation. In Supabase Auth settings, enable email confirmations, set the project Site URL, and allow the app URL plus `/auth/callback` as a redirect URL before opening account creation to students. Email verification confirms mailbox access; it does not independently verify FUTO enrollment.
