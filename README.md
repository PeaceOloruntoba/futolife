# FUTO Life

Mobile-first virtual FUTO campus. The Next.js application wraps the supplied Three.js proof of concept and adds a location directory and account/profile foundation. The campus remains a browser-side experience; Next.js route handlers provide the server boundary, and Supabase provides Postgres and authentication.

## Local setup

1. Install Node.js 20.9 or newer.
2. Install dependencies with `npm install`.
3. Put `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local` (or `.env`).
4. Initialize and link the Supabase CLI if this checkout has not already been linked:

   ```powershell
   npx supabase@latest init
   npx supabase@latest login
   npx supabase@latest link --project-ref <project-ref>
   ```

   The project ref is in the Supabase dashboard URL. Linking may ask for the database password; it is separate from the public key in the app environment.

5. Preview and apply migrations to the linked remote project:

   ```powershell
   npx supabase@latest db push --dry-run --linked
   npx supabase@latest db push --linked
   ```

   The migrations in `supabase/migrations/` create the profile and campus-location tables, policies, and initial location inventory. `--linked` makes the target explicit.

6. Start the app with `npm run dev` and open `http://localhost:3000`.

## First release scope

- 3D campus prototype at `/campus/index.html`, embedded in the Next.js campus shell.
- Searchable location directory served from Supabase Postgres, seeded from the supplied inventory; the bundled JSON is the no-credentials fallback.
- Email/password sign-in, account creation and editable basic student profile when Supabase is configured.
- Guest campus exploration remains available.

Chat, group creation, multiplayer presence, events and missions are later releases. Many positions in the supplied inventory are null or explicitly provisional. Directory items carry an unverified label until the project has trustworthy evidence. The prototype's map/walk controls use local estimated positions and are not a verified geographic map.

## Supabase configuration

Do not commit `.env.local`, service-role keys, or credentials. The browser receives only the project's public publishable key (legacy anon keys are also accepted). Profile reads and writes are protected by row-level security and tied to the signed-in user's auth ID. `campus_locations` is publicly readable; only reviewed, evidence-backed records should be treated as verified.

Account creation accepts any email address and requests email confirmation. In Supabase Auth settings, enable email confirmations, set the Site URL to `http://localhost:3000`, and allow `http://localhost:3000/auth/callback` as a redirect URL for local development. Set the production Site URL and callback URL before launch. Email verification confirms mailbox access; it does not independently verify FUTO enrollment.

Before accepting student sign-ups, configure custom SMTP in Supabase Auth. Supabase's default mail service is restricted to project-team email addresses and low-volume testing; it is not suitable for a campus launch. See the [Supabase custom SMTP guide](https://supabase.com/docs/guides/auth/auth-smtp).
