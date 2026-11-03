# FUTO Life — Handoff

## Current state

- Next.js + TypeScript app with Supabase/Postgres at `/`; campus explorer at `/explore`; student community at `/community`; admin tools at `/admin`.
- Community includes friend requests, friends-only chats, group chats, posts, `@friend` tagging, indexed `#hashtags`, likes, comments, reports, and profile/referral management.
- Email confirmation and forgot-password recovery are implemented. Password reset uses `/reset-password`.
- Campus explorer includes a collapsible directory, schematic map, touch joystick and swipe look; desktop uses WASD, arrows and Shift; mobile has a hold-to-run button.
- Recent UI work separates chat list/thread scrolling, follows the newest messages, and resizes the chat view for the mobile keyboard.
- Latest controls/auth update: moved the mobile movement stick to the bottom-left with safe-area spacing; sign-in and signup password fields now have accessible Show/Hide buttons.
- Supabase migrations are in `supabase/migrations/`, through `202611020004_post_hashtags.sql`.

## Known gaps / outstanding bugs

- **Campus data is not launch-ready for navigation:** many places have null, provisional or unverified coordinates. The 3D campus is a prototype; the schematic map is not a verified geographic map. A sourced, georeferenced campus dataset and review of place names/positions are still needed.
- **Mobile chat and controls need device verification:** TypeScript and production builds pass, but keyboard resizing, scrolling, touch movement and the RUN control have not had a comprehensive real-device test.
- **Operational setup remains:** apply any unapplied migrations to the linked Supabase project; configure production Site URL, auth callback/recovery redirect allow-list, email delivery, and Realtime for `messages`.
- Replace the sample `hello@futolife.com` contact address on legal pages with a monitored address before public launch. Review Privacy/Terms text for the actual operator and policies.
- Admin access requires the verified `admin@futolife.com` account to be created through normal signup; there is no built-in default password. Use a private password.

## Immediate next steps

1. Apply pending migrations: `npx supabase@latest db push --dry-run --linked`, inspect the plan, then `npx supabase@latest db push --linked`.
2. Configure Supabase Auth URLs and email delivery for the deployed domain; verify signup, forgot-password, and reset links end to end.
3. Do a focused mobile pass on Android and iOS: verify the lower joystick remains reachable and does not conflict with the action button, plus chat with keyboard open, conversation switching, long-history scrolling, swipe look and hold-to-run.
4. Obtain a current campus map or surveyed coordinates, confirm locations with FUTO, and import/review the data in the admin dashboard. Keep uncertain entries visibly unverified.
5. Replace legal contact details, then run the planned comprehensive end-to-end and production deployment checks.

## Local run

```powershell
npm run dev
```

For a phone on the same Wi-Fi, run `npm run dev -- --hostname 0.0.0.0`, find the computer's IPv4 address with `ipconfig`, and browse to `http://<computer-ip>:3000` on the phone. Add the phone-accessible callback URL to Supabase Auth redirects if testing email links that way.
