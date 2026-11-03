# FUTO Life

Mobile-first virtual FUTO campus. Next.js provides a public landing page, a campus explorer at `/explore`, a full community page at `/community`, and protected admin tools. The explorer wraps the supplied Three.js proof of concept; Supabase provides Postgres, authentication, storage and realtime messages.

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

   The migrations in `supabase/migrations/` create profiles, the campus-location inventory, friend requests, posts and comments, direct/group conversations, avatar storage policies, the campus admin role, and their row-level security rules. `--linked` makes the target explicit.

6. Start the app with `npm run dev` and open `http://localhost:3000`.

## First release scope

- Public landing page with a responsive footer and Privacy/Terms pages.
- 3D campus prototype at `/campus/index.html`, embedded at `/explore`, with a labeled collapsible menu and responsive mobile drawer.
- Keyboard: W/A/S/D move, arrow keys look, Shift sprints. Touch: swipe on the scene to look, use the movement stick near the bottom-left, and hold RUN near the bottom-right to sprint.
- To open the dev server on a phone on the same Wi-Fi, run `npm run dev -- --hostname 0.0.0.0`, find the computer's IPv4 address with `ipconfig`, then visit `http://<computer-ip>:3000` on the phone.
- Schematic map plots saved local positions and lists locations without positions; it does not draw roads or claim geographic accuracy.
- Searchable location directory served from Supabase Postgres, seeded from the supplied inventory; the bundled JSON is the no-credentials fallback.
- Email/password sign-in with confirmation, profile setup after confirmation, confirmation resend, profile editing, and sign-out.
- Community routes are independent: `/community/feed`, `/community/friends`, `/community/messages`, `/community/profile`, and `/community/messages/<conversation-id>`. The chat route opens full screen with a back action and profile links.
- Student discovery, friend requests and approval, friend lists, profile photos, a friends-only feed with friend tags, reactions and comments, direct messages and friend-only group chats. Chat includes unread counts, per-message read receipts, private images (10 MB max), videos/documents (25 MB max), voice notes and emoji.
- Admin dashboard at `/admin` for managing place details, WGS84 and 3D coordinates, evidence, verification status, photos and GeoJSON imports. It also supports suspending/restoring users, reviewing post reports, and deleting a post after five distinct reports. Imported coordinates remain provisional; reviewed locations need evidence before they can be marked verified.
- Student referral codes and links with a persistent, multi-level referral chain. Referral tracking currently has no rewards.
- Friend tagging by typing `@` in a post composer; `#hashtags` are indexed in Postgres for future feed discovery.
- Guest campus exploration remains available.

Multiplayer presence, events and missions are later releases. Social tools require a confirmed account and a completed profile. A direct chat is accessible only while both participants are accepted friends; group members are selected from the creator's accepted friends. Posts are visible to their authors and accepted friends. Users can report posts with a reason; administrators may delete a post once five distinct users have reported it. Configure Supabase Realtime for the `messages` table for immediate incoming chat updates; messages remain available from Postgres if realtime is temporarily disconnected. Many positions in the supplied inventory are null or explicitly provisional. Directory items carry an unverified label until the project has trustworthy evidence. Admin GeoJSON imports save place records but never mark features verified automatically. A current, georeferenced campus source is still required for a real navigable map.

## Supabase configuration

Do not commit `.env.local`, service-role keys, or credentials. The browser receives only the project's public publishable key (legacy anon keys are also accepted). Profile reads and writes are protected by row-level security and tied to the signed-in user's auth ID. `campus_locations` is publicly readable; only reviewed, evidence-backed records should be treated as verified.

Account creation accepts any email address and requests email confirmation. In Supabase Auth settings, enable email confirmations, set the Site URL to `http://localhost:3000`, and allow `http://localhost:3000/auth/callback` as a redirect URL for local development. Set the production Site URL and callback URL before launch. Email verification confirms mailbox access; it does not independently verify FUTO enrollment.

The confirmed account for `admin@futolife.com` receives the admin role automatically from the admin migration. Create that account through the normal sign-up flow, verify its mailbox, and choose a private, unique password in Supabase Auth. The app does not contain a default admin password. Admin role checks and campus write permissions are enforced by Supabase row-level security, not just by hiding the dashboard link.

Before accepting student sign-ups, configure custom SMTP in Supabase Auth. Supabase's default mail service is restricted to project-team email addresses and low-volume testing; it is not suitable for a campus launch. See the [Supabase custom SMTP guide](https://supabase.com/docs/guides/auth/auth-smtp).
