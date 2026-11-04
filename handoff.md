# FUTO Life — Handoff

## Current state

- Next.js + TypeScript app with Supabase/Postgres at `/`; campus explorer at `/explore`; student community at `/community`; admin tools at `/admin`.
- Community includes friend requests, friends-only chats, group chats, posts, `@friend` tagging, indexed `#hashtags`, likes, comments, reports, and profile/referral management.
- Email confirmation and forgot-password recovery are implemented. Password reset uses `/reset-password`.
- Campus explorer includes a collapsible directory, schematic map, touch joystick and swipe look; desktop uses WASD, arrows and Shift; mobile has a hold-to-run button.
- Recent UI work separates chat list/thread scrolling, follows the newest messages, and resizes the chat view for the mobile keyboard.
- Latest controls/auth update: moved the mobile movement stick to the bottom-left with safe-area spacing; sign-in and signup password fields now have accessible Show/Hide buttons.
- Latest platform feedback update: added a global Sonner toaster (color-coded, top-right) and routed account confirmation/recovery, social, admin, and reset-password notices into it. Added/extended pending labels and disabled states for chat actions and admin confirmations, plus initial loading labels for admin data.
- Latest messaging update: added per-message read receipts, RPC-backed unread totals and conversation badges, friend-request-only tab badges, friend/chat/message totals, private image/video/document uploads, voice recordings, and an in-app emoji picker. New migration: `202611030001_chat_receipts_media.sql`.
- Latest community UI update: split Feed, Friends, Messages, and Profile into independent routes with a bottom icon bar; chats now open at `/community/messages/<id>` as a full-screen conversation with a back button and links to student profiles. Replaced receipt, composer, reaction, navigation, and password visibility glyphs with `react-icons`. Voice recorder MIME types are normalized (codec parameters removed) before validation/upload to fix unsupported voice-note formats.
- Latest routing/auth fix: removed the Vercel catch-all rewrite that sent every route to `/` (the cause of chat deep links rendering the landing page). Added a root-level Supabase auth session provider that subscribes once and persists through client navigation; community views now block with a full-screen session restore indicator and a page-level loading state until profile data is ready.
- Latest community usability update: message threads jump to the newest message after chat/message changes; profile photos on student detail pages open in an image viewer with zoom controls and wheel zoom; community scrollbars use a slim themed style; Friends and Messages list pages now have independent search fields. Auth/profile bootstrap now fetches the current profile first and releases the blocking loader before loading larger feed, directory, referral, and chat datasets in parallel.
- Latest media presentation update: image and video messages no longer render their stored filename as message text; document names remain visible. Replaced the native voice-note audio controls with a responsive custom player featuring a large play/pause control, animated-style waveform, seek interaction, elapsed/total duration, and no browser overflow menu.
- Latest notification/audit update: added persistent in-app notifications for incoming friend requests, accepted requests, and new direct/group messages, with realtime badges/toasts, mark-read actions, and navigation to the relevant screen. Added migration `202611030002_notifications_activity_log.sql`: notification records are recipient-private; audit history is append-only and admin-readable only. Database triggers record signups, confirmation, profile changes, friendship changes, posts/comments/reactions/reports, messages and per-message reads, conversations/members, referrals, admin role changes, campus place changes, and notification reads. App events record login/logout, password reset requests/changes, profile/chat/place views, and opening the audit tab. Logs exclude message contents and passwords. Added an Activity tab to the admin dashboard and updated the Privacy page.
- Latest chat notification/scroll update: chat threads now remain pinned to the latest message on open and while new content/media sizes load, but stop auto-following if the user scrolls up. Added user opt-in for OS/browser notifications while FUTO Life is open or backgrounded, including per-account device preference, persisted browser permission, service-worker notification clicks, and a notification control in campus/community/admin surfaces. Supabase auth remains rooted in the app layout; notification permission/preferences persist separately per browser and account.
- Latest discovery/install/onboarding update: conversation lists now sort by their most recent message and update their order through Supabase Realtime. Added a web app manifest and app icon for home-screen installation, plus a delayed install/notification invitation after sign-in (per-account dismissal state). Added a first-login guided overlay covering campus exploration, the campus directory, community feed, conversations, and profile; users can skip it and the completion choice is saved per account. Notification permission is requested only after the user presses Enable.
- Supabase migrations are in `supabase/migrations/`, through `202611030002_notifications_activity_log.sql` (pending application to the linked project).

## Known gaps / outstanding bugs

- **Campus data is not launch-ready for navigation:** many places have null, provisional or unverified coordinates. The 3D campus is a prototype; the schematic map is not a verified geographic map. A sourced, georeferenced campus dataset and review of place names/positions are still needed.
- **Mobile chat, controls, attachments, voice recording, and toast placement need device verification:** verify the new bottom navigation, full-screen chat/back flow and profile details; keyboard resizing and scrolling; media previews/downloads; microphone permission and normalized recording formats; upload limits; touch movement; RUN; and toast fit. Cross-user read receipt/unread synchronization needs testing with two accounts and Realtime enabled.
- **Production routing change needs deployment:** redeploy to Vercel after the `vercel.json` rewrite removal, then open a known `/community/messages/<conversation-id>` link directly to verify deep-link routing in the deployed build.
- **Apply the latest notification/audit migration:** run `npx supabase@latest db push --linked` to create notification and audit tables/functions/triggers. Then verify message/friend notifications with two accounts and confirm the Activity tab is visible only to the admin account.
- **Browser alerts require opt-in per browser/device:** test on HTTPS (or localhost), allow notifications from the bell’s Enable control, then background the tab and receive a message or friend request. Closed-browser push delivery needs a push-subscription sender and VAPID configuration; the current web alert works while the app tab is open or backgrounded.
- **Install and onboarding need device checks:** verify the manifest/home-screen install prompt on current Android Chrome and iOS Safari. iOS uses the browser Share menu’s “Add to Home Screen” flow; its install prompt is not controlled by Chromium’s `beforeinstallprompt` event. Walk the tutorial on mobile and desktop, including Skip, and confirm the account-scoped completion/dismissal state.
- **Operational setup remains:** apply any unapplied migrations to the linked Supabase project; configure production Site URL, auth callback/recovery redirect allow-list, email delivery, and Realtime for `messages`.
- Replace the sample `hello@futolife.com` contact address on legal pages with a monitored address before public launch. Review Privacy/Terms text for the actual operator and policies.
- Admin access requires the verified `admin@futolife.com` account to be created through normal signup; there is no built-in default password. Use a private password.

## Immediate next steps

1. Apply pending migrations (including `202611030001_chat_receipts_media.sql` and `202611030002_notifications_activity_log.sql`): `npx supabase@latest db push --dry-run --linked`, inspect the plan, then `npx supabase@latest db push --linked`.
2. Configure Supabase Auth URLs and email delivery for the deployed domain; verify signup, forgot-password, and reset links end to end.
3. Do a two-account messaging pass, then a focused mobile pass on Android and iOS: check read/unread counts and receipts, newest-conversation ordering after realtime messages, each accepted file type/size boundary, voice notes and microphone denial, emoji, keyboard open, conversation switching, long-history scrolling, swipe look, and hold-to-run. Verify the install prompt and first-login walkthrough on each platform.
4. Obtain a current campus map or surveyed coordinates, confirm locations with FUTO, and import/review the data in the admin dashboard. Keep uncertain entries visibly unverified.
5. Replace legal contact details, then run the planned comprehensive end-to-end and production deployment checks.

## Local run

```powershell
npm run dev
```

For a phone on the same Wi-Fi, run `npm run dev -- --hostname 0.0.0.0`, find the computer's IPv4 address with `ipconfig`, and browse to `http://<computer-ip>:3000` on the phone. Add the phone-accessible callback URL to Supabase Auth redirects if testing email links that way.
