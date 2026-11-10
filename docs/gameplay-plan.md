# FUTO Life gameplay plan

## Product loop

Explore the campus with friends, discover places and complete short activities, earn XP and non-cash campus coins, then spend coins on in-game mobility and appearance. Keep student community tools available as a distinct app feature; connect them to exploration with opt-in group activities and party invites.

## Mission catalogue

### First visit
- **Welcome to FUTO** — learn movement, camera, map and interaction controls.
- **Start at the Main Gate** — orient at the entrance and follow the first reviewed route.
- **Find your bearings** — discover a junction, a study destination and one student-life place.
- **Bring a friend along** — invite a friend who accepts and completes their first discovery; award each account once.

### Discovery adventures
- **Campus essentials** — visit the Senate, Main Library, a lecture venue, a school complex and an eatery.
- **Study loop** — connect library and lecture destinations using reviewed walkways.
- **Taste of campus** — visit a chosen set of mapped food destinations.
- **Campus stories** — answer short, reviewed FUTO trivia at a landmark. Questions need an editor and source.
- **Photo spot** — reach a designated landmark and optionally submit a photo. Do not require faces or publish a photo without consent.
- **Explore with your school** — a rotating trail across verified school locations.
- **Weekend explorer** — a longer multi-stop route designed for walking, bikes or shuttle travel.

### Daily and weekly play
- **Daily arrival** — one capped login reward per Africa/Lagos calendar day.
- **Daily discoveries** — find one new place or complete one short route.
- **Weekly campus trail** — complete a curated set of locations across multiple days.
- **Streak milestones** — modest milestone rewards with a recovery day, so one missed login does not erase a long streak.
- **Campus event trail** — time-limited, editor-created activities tied to published event information.

### Social adventures
- **Meet-up route** — a party leader starts a route and members opt in; completion is individually validated.
- **Friend finder** — share a place card or invite a friend to a selected destination.
- **Group explorer** — complete a route together, with accessible walking or ride options.
- **Community guide** — experienced players complete a helpful orientation trail with new players.

All social discovery and location sharing should be opt-in. Never reveal a player's live position to friends by default.

## Game economy

- Coins and XP are game-only balances. No cash value, cash-out, peer transfer, real-world prize, paid coin purchase, or pay-to-win advantage.
- Coin sinks: cosmetic outfits, backpacks, emotes, trails, bike styles, vehicle skins, and capped in-game ride fares.
- Bikes can be unlocked or rented at marked racks. Shuttle routes use reviewed stops and fixed, clearly labeled game fares. Taxi is an on-demand in-game ride animation/fast-travel option, not a live FUTO taxi service.
- Car ownership is a later cosmetic/role-play feature, introduced only after road, collision and safety design is stable. A car must not give mission or leaderboard advantage.
- Display prices and fare before the player confirms. Provide a free walking option for every route.

## Validation and persistence requirements

- Store challenge definitions and versions server-side. Keep an append-only transaction ledger with idempotency keys; the client never writes balances.
- Check user eligibility, mission version, objective order, completion window, daily caps, cooldowns, one-time referrals and available balance in protected Postgres functions.
- Treat client movement as untrusted. Until a trusted server event path is implemented, show discovery progress as preview only and do not grant coins for it.
- Keep quests and rewards readable for guests, but require a signed-in, eligible account to persist claims. Email confirmation alone is not proof of current FUTO enrollment.
- Audit admin changes to mission values, prices, rewards and grants. Add rate limits and anomaly review before leaderboards or referral rewards.

## Release order

1. Map review/publication and a working mobile/desktop exploration HUD.
2. Typed game bridge and verified place arrival events.
3. Server-side profiles for XP, wallet ledger, daily streaks and challenge progress.
4. Discovery missions and cosmetic shop.
5. Bikes and fixed-route shuttle fast travel; add taxi after movement and fares are stable.
6. Friend parties, event trails and opt-in leaderboards after abuse, consent and privacy rules are implemented.
7. Cars only after the campus road and collision network is reviewed.

## Implemented starter slice

- A protected Postgres ledger and `get_game_state`, `claim_game_challenge`, `purchase_game_item`, and `consume_game_ride_ticket` functions are in migration `202611090001_game_economy_and_challenges.sql`.
- The first claimable challenges are a daily login reward and two answer-checked quizzes. The database uses Africa/Lagos day boundaries and awards a capped weekly streak bonus. Location missions remain visible but unclaimable until a reviewed arrival signal is available.
- The Explore game hub shows the authenticated user's XP, coins, streak, challenge list, store and inventory. An authenticated bike mount consumes one purchased ticket through the parent app's same-origin message bridge. Guests can try the bike without earning or spending game coins.
- Shuttle/taxi ticket use, vehicle spawning, friend-party missions, leaderboards and referral rewards are not yet connected. Apply the migration only after checking and previewing the linked Supabase migration state.
