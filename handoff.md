# FUTO Life — Product and Implementation Handoff

## Product direction

Build FUTO Life as a campus exploration game first, with the student community as a connected but separate feature. Keep the current stack: Next.js + TypeScript for the app and server routes, Supabase Auth/Postgres/Storage/Realtime for accounts and persistent data, and Three.js for the interactive 3D campus. Do not replace the stack to add game features.

The game loop should be: **explore → discover a real campus place → complete a challenge → earn non-cash coins/XP → unlock cosmetic rewards → explore further**. Guests can explore, but only signed-in accounts earn and save rewards. Treat coins as in-app game points with no cash value, transfer, or withdrawal at launch.

## Current state and constraints

- Campus is at `/explore`. The 3D world is a Three.js prototype in `public/campus/index.html`; Next.js wraps it in an iframe and sends movement/place-selection messages.
- The separate 2D “map” is currently a schematic plot of saved local X/Z points. It is not a surveyed road map or geographic map. Map positions are normalized to the available points, so visual spacing is not a reliable scale.
- `public/campus/locations.json` records that the Main Gate has no verified GPS origin and most named places have no coordinates or footprints. Some 3D route/building details are illustrative or unidentified. Treat them as prototypes, not navigation facts.
- Admins can create/edit campus place points, upload photos, and save geographic and local coordinates. `campus_locations` currently stores point-like fields, position status, evidence, and image URL; it does not yet model building polygons, pedestrian paths, terrain, or shuttle routes.
- Current controls: desktop WASD movement, arrow-key look, Shift sprint; mobile joystick, touch look, and hold-to-run. There is no persistent movement progression, coin wallet, challenge engine, bike, or shuttle feature yet.
- Auth, profiles (student/alumni/visitor), community, admin tools, notifications, and Supabase migrations already exist. The linked production database’s migration state must be checked before any feature rollout.

## Recommended campus mapping approach

### 1. Obtain a source that can legally become FUTO Life map data

First request the current campus master plan or site plan from FUTO Physical Planning, Works/Services, or the relevant campus authority. Ask for a georeferenced GIS/CAD export if available (GeoPackage, SHP, DXF/DWG with coordinate reference, or GeoPDF), plus permission to use it in FUTO Life. Record the edition/date and terms.

If no usable digital plan exists, georeference an approved paper/image plan in QGIS using several well-distributed control points, then validate it during a campus walk. Use QField/QGIS or a small survey form to record points, paths, entrances, accuracy estimate, collector, time, photos, and notes. Phone GPS is useful for reconnaissance but can drift near buildings/trees; record the device-reported accuracy and keep uncertain results provisional. For tighter building/road accuracy, work with a surveyor or use RTK GNSS/control points and a total-station survey where authorized.

Use public OpenStreetMap data only under its attribution and ODbL requirements, and retain the source/provenance for imported features. Google Maps can be an in-app reference/base-map option only under the applicable Maps Platform terms: do not trace Google imagery or export/cache Google map/photo content into the Three.js world or a permanent FUTO Life dataset. Google Places photos require their own API use and attribution. See [Google Places policies](https://developers.google.com/maps/documentation/places/web-service/policies?hl=en) and [OpenStreetMap attribution guidance](https://osmfoundation.org/wiki/Attribution_Guidelines).

### 2. Collect a small, verified pilot before mapping the whole campus

Start with a continuous playable route: Main Gate, major junction/roundabout, Senate, library, one academic/department area, one eatery/student-life area, and one fellowship or practical venue. For every feature, collect:

- Stable ID, official/common name, category, and alias/search terms.
- Geometry type: point for entrance/POI, polygon for building footprint, line for walkways/roads/shuttle routes.
- WGS84 longitude/latitude or GeoJSON geometry, plus a projected local coordinate for Three.js.
- Source, license/permission, collection date, collector, accuracy estimate, verification status, and review notes.
- For buildings: footprint, entrance side, approximate height/floors, and licensed front/side photos if the game model will use them.
- For paths/routes: surface/accessibility notes, safe crossings, and connectivity to adjacent paths.

Use GeoJSON as the exchange format and QGIS as the review/editing tool. Preserve source geometry in WGS84/EPSG:4326; transform to a local metric CRS (likely UTM Zone 32N for FUTO; confirm against the authoritative source) for world X/Z. Keep coordinate conversion in one documented importer so the web map and Three.js world cannot drift apart. Do not set `verified` just because a feature appears in a public map. Define and test accuracy thresholds with the survey source, and show provisional/unverified labels until an admin/reviewer approves the evidence.

### 3. Build an import and review workflow

Extend the admin map tool to preview imported points, polygons, and paths against the source, show missing/poor provenance, compare duplicate names/IDs, and reject invalid geometry. Import as a versioned dataset with a review summary; allow an admin to publish a reviewed version. Keep photos in Supabase Storage with an explicit source/permission note. Never silently overwrite reviewed coordinates from an unverified import.

### Google Maps decision

Use Google Maps/Places only if the product needs a Google-rendered map or live Places content and the budget/terms work. It is not a shortcut for creating a persistent, editable, Three.js campus map: Google’s policies prohibit extracting or tracing map imagery/content for a separate dataset/model. For an owned navigable game world, use FUTO-authorized plans plus field survey, with OSM data where license-compatible.

## Game design recommendation

### Core loop and rewards

- Add onboarding discovery missions: find the Main Gate, locate a landmark, visit a lecture/department area, and learn the map controls.
- Add short daily/weekly challenges: discover N new places, follow a verified route, visit a themed set (food, study, fellowship), or finish a timed obstacle course.
- Reward coins and XP for verified game events; reward cosmetics first (avatar outfits, trails, emotes, bike styles, profile badges). Add opt-in leaderboards after anti-cheat and privacy rules are tested.
- Make the Temple Run-like activity a separate replayable timed course/mini-game, not the default campus navigation. This preserves the social/campus exploration loop and avoids turning every location into an obstacle course.
- Coins have no monetary value at launch: no purchase, cash-out, peer transfer, or real-world prize. Reassess only with explicit policy, legal, fraud, and financial review.

### Server authority and abuse controls

The browser/Three.js client is untrusted. It may animate the player and report checkpoint events, but it must not directly award coin balances. Put wallet changes in an append-only Postgres ledger and expose narrowly scoped server/SQL functions that validate challenge rules, unique completion, cooldowns, account eligibility, and reward limits before writing a transaction. Calculate balance from the ledger or maintain a balance updated only by the protected transaction function. Log admin challenge changes and reward grants. Add idempotency keys so retries cannot duplicate rewards. Do not require background GPS for the virtual game; if optional real-world check-ins are later added, request permission clearly and minimize location retention.

## Bikes and shuttles

1. **Bikes first:** add marked spawn/rack points, mount/dismount interaction, different acceleration/top speed, camera follow, turning/braking, collision with buildings, and clear mobile controls. Keep walking useful for interiors, narrow routes, and discovery interactions. Balance speed so bikes feel faster without skipping all challenge checkpoints.
2. **Shuttles second:** add verified stops and route LineStrings. At stops, let the player board an animated shuttle and travel between stops with a short, skippable transition. It is a game fast-travel service, not a promise of live FUTO transport timetables until those are sourced and maintained.
3. Add stamina/fuel only if playtesting shows it improves choices; avoid a punishment mechanic that blocks exploration. Vehicle unlocks should initially be cosmetic or earned through play, not pay-to-win.

## Phased implementation plan

### Phase 0 — Decisions and map-data acquisition

- Request a FUTO-authorized campus map/site plan and use terms; identify a FUTO contact or survey partner.
- Approve the pilot route/place list and data accuracy/status rubric.
- Decide that coins are non-cash, non-transferable game points for the initial release.
- Deliverable: source inventory, licensed sample data, field-survey plan, and a small pilot GeoJSON.

### Phase 1 — Reliable, playable campus map

- Expand location schema/import pipeline for point, polygon, and line geometry; preserve source, license, accuracy, survey date, and review state.
- Add admin preview/review/publish for GeoJSON and a way to correct one feature without re-importing the whole campus.
- Generate the 2D map from real geometry with a scale/north indicator, route/path layer, legend, place search, and clear confidence labels. Use a compatible tile/map source only with attribution and terms.
- Refactor the Three.js data boundary so verified map data generates the walkable roads, building footprints, collision boundaries, navigation targets, and landmarks. Keep illustrative geometry visually marked until replaced.
- Acceptance: pilot features align with source/field checks; route is connected; positions have provenance/status; map and 3D transforms agree; mobile map remains usable.

### Phase 2 — Game foundations

- Extract the current iframe game messaging into a typed, versioned bridge (player position, speed, nearby place, checkpoint, mount state) with bounds validation.
- Add challenge definitions, per-user progress, reward ledger, and protected completion/claim functions in Supabase migrations.
- Build first-login tutorial and onboarding missions; guests may play/explore but reward claims require a signed-in, verified account.
- Add a player HUD for coin/XP totals and active challenge progress without covering movement controls.
- Acceptance: server rejects duplicate/forged/out-of-order claims; only allowed account earns; disconnect/retry cannot duplicate coins; admin audit trail records reward operations.

### Phase 3 — Challenges and retention

- Release discovery badges and repeatable daily/weekly challenge templates.
- Add the separate timed obstacle/runner course with clear start/finish, reset, and accessibility options; save best times server-side.
- Add cosmetics as the first coin sink; test reward pacing and leaderboards with a small group before campus-wide rollout.
- Acceptance: meaningful progression without requiring spending, no unbounded coin farming, and mobile performance is acceptable on mid-range Android devices.

### Phase 4 — Bikes and shuttle travel

- Implement bikes after collision/path geometry is stable; pilot on a short route and add accessible mount controls.
- Implement shuttle stops/routes after they are verified; animate travel and allow skip/exit at safe stops.
- Acceptance: no driving through buildings, all routes have provenance, movement remains controllable on touch and keyboard, and fast travel does not bypass challenge checks.

### Phase 5 — Soft launch, observe, expand

- Pilot with freshers and a small test group; monitor crashes, frame rate, route misses, challenge completion, reward anomalies, and user feedback.
- Publish new districts/features in small scheduled releases; keep uncertain map areas explicitly provisional.
- Expand map coverage only when data is sourced and reviewed. Add social/competitive mechanics only after privacy and moderation design is ready.

## Next actions

1. Get the FUTO map/site-plan permission and choose a survey owner/contact.
2. Agree on the first 8–12 pilot locations and one connected walking route.
3. Confirm the coin policy: non-cash, non-transferable, earned only by signed-in users (recommended).
4. Collect/import the pilot map data, then implement Phase 1 before adding vehicles or reward claims.
5. Check linked Supabase migration status and deployment before applying any new schema.

## Existing local run commands

```powershell
npm run dev
```

For phone testing on the same Wi-Fi:

```powershell
npm run dev -- --hostname 0.0.0.0
```

Use the computer’s LAN IP on the phone. Supabase email callbacks also need the phone-accessible URL in the Auth redirect allow-list when testing email links.

## Latest update — conversation message actions (2026-11-08)

Implemented WhatsApp-style message interactions in the conversation view:

- Select/tap a message to reveal contextual actions and quick reactions; swipe a message right on touch screens to reply.
- Reply previews link to the selected message. Users can edit their own text messages and delete their own messages for everyone; deleted messages render as “This message was deleted”.
- Reactions are stored per user and message, with live updates through Supabase Realtime.
- Database migration `supabase/migrations/202611080001_chat_message_actions.sql` adds edit/deletion/reply fields, message reaction storage and RLS, authorized edit/delete RPCs, and activity audit events that omit message contents.
- Editing is text-only. Any message can be replied to or reacted to; media messages can be deleted by their sender.

### Rollout steps

1. Preview the linked Supabase migration: `npx supabase@latest db push --dry-run --linked`.
2. Apply it to the linked project: `npx supabase@latest db push --linked`.
3. Deploy the app after the migration completes. Verify using two accounts: edit/delete own messages, reply by action and swipe, toggle reactions, and confirm other conversation members receive realtime updates.

TypeScript check (`npx tsc --noEmit`) passes. Full functional testing remains pending.

## Latest update — stable chat composer on mobile and desktop (2026-11-08)

- Tightened the full-screen conversation flex layout so the message list takes the available height while the composer stays visible at the bottom and does not shrink.
- Removed the input focus `scrollIntoView` page jump; focus now keeps the message stream at the latest message.
- Improved mobile keyboard detection by comparing the visual viewport against the device screen height, so the chat view follows the visible area when the software keyboard opens.
- TypeScript check and visual testing are pending for this layout adjustment.

## Latest update — persistent profile device settings (2026-11-08)

- Added an **App & notifications** section to the signed-in profile with persistent home-screen install and browser notification controls.
- Install requests are routed through the existing PWA prompt handler, preserving the native install prompt when available and the browser-menu guidance fallback.
- Notification permission and the per-device preference stay synchronized with the notification center; the profile shows enabled, unsupported, and browser-blocked states.

## Latest update — private message deletion (2026-11-08)

- Message actions now offer **Delete for me** for received messages. The sender can choose **Delete for me** or **Delete for everyone**; edit remains available only on the sender’s own text messages.
- Added `supabase/migrations/202611080002_message_delete_for_me.sql` with a private per-profile hidden-message table, RLS, a membership-checked `hide_my_message` RPC, audit event, and Realtime publication.
- Hidden messages are filtered from the current conversation and conversation previews and stay hidden for that user after reload or on another device. Delete-for-everyone continues to replace the message with the shared deletion notice.
- Apply both pending chat migrations with `npx supabase@latest db push --dry-run --linked`, then `npx supabase@latest db push --linked`.

## Latest update — photo-first campus wayfinding (2026-11-08)

- Reviewed the attached `futo-life-concept-hud.html` and `hud.smoke.test.js` as visual/technical references. The HUD concept suggests stronger map context, destination cards, and clearly marked confidence; demo social/quest content remains reference-only for this map pass.
- Updated Explore directory entries to show the campus photo thumbnail beside every location when `image_url` is available. Selecting a place now opens a persistent destination card with its photo, category, description, location confidence, and map/navigation actions.
- Existing map markers continue to use the uploaded photos and now highlight the selected destination. The card labels verified, approximate, and unverified positions separately.
- Selecting an unverified place no longer starts auto-walking to potentially misleading coordinates. Navigation is enabled only for verified or provisional places with saved local coordinates; provisional coordinates remain explicitly labeled as approximate.
- No new migration is needed; the Explore API already reads `campus_locations.image_url` from Supabase. Photos improve visual recognition, but actual building/road geometry still requires authoritative or surveyed map data.

## Latest update — master-plan road draft and exploration prototype (2026-11-09)

- The owner authorized use of the UPDATED FUTO MASTER PLAN image included in the supplied map-data pack. The image remains unreferenced and its revision date is unknown.
- Added `public/campus/map-data-v0.2.json`, derived from the 12 pixel-coordinate road centerlines in the v0.2 draft. It retains the image-pixel origin and labels its local scale and Main Gate alignment as assumptions. All roads remain provisional and must not be described as surveyed navigation.
- The Three.js prototype now draws the road traces as textured road/shoulder/verge ribbons, adds roadside tree rows, shows a live schematic minimap, and exposes the existing camera/map/nearby controls. The campus map dialog includes a separate road-trace preview so it is not confused with the existing saved-place pins.
- A walk-up bike interaction is available as a local prototype. It increases movement speed and supports mobile interaction controls; it does not charge a fare, persist a vehicle, or grant rewards.
- `docs/gameplay-plan.md` records proposed discovery, daily/weekly, streak, social, transport and game-coin sinks. No reward, wallet, fare, challenge-claim, shuttle, taxi or car backend has been added. Do not award currency from client-side movement.
- Mobile rendering remains performance-sensitive because the Three.js scene and map road/foliage layer now cover a larger area. Field validation and visual review on representative phones are still required.

## Latest update — game hub, starter challenges and bike tickets (2026-11-09)

- Added `supabase/migrations/202611090001_game_economy_and_challenges.sql` with a protected append-only coin/XP ledger, daily streak state, challenge claims, inventory, shop and ride-ticket use. Daily rewards use the Africa/Lagos calendar day. Trivia answers are checked inside a protected database function and are not readable through the client API.
- The new Explore **Missions & rewards** panel reads its state from Supabase. It supports daily arrival, two starter quizzes, cosmetic/ride-ticket purchases, and inventory. Senate and Library arrival missions are shown as locked until a reviewed position and server-validated arrival flow exist.
- A signed-in player must own and consume a bike ride ticket to mount the prototype bike. Guests may try the bike for free; that interaction cannot award currency. The shuttle and taxi tickets, bike fares, and vehicle catalog still need their in-world route/vehicle interactions before release.
- The migration has been added locally only. Check the linked Supabase project's migration state and preview before applying it. No production migration was pushed as part of this change.
- Daily-login and trivia rewards are server-validated. The browser never writes a balance. Position claims remain disabled until movement and place arrival are validated server-side against reviewed data.
