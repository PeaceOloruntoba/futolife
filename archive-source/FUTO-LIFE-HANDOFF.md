# FUTO Life: Project Handoff

Prepared 2026-10-22 by Claude. **Documentation only.** No code was changed and nothing was republished while writing this. The facts in sections 3 and 8 were re-read from the project files in this session. Everything else comes from the conversation history.

## 0. How to read this

| Tag | Meaning |
|---|---|
| **CONFIRMED** | Stated by the product owner. |
| **PROPOSED** | My suggestion. Built or described, but not explicitly approved. |
| **ASSUMPTION** | A guess I used to keep moving. Must be replaced by evidence. |
| **BUILT** | Exists in the files. |
| **TESTED-HEADLESS** | Passes Node tests. **No browser has ever been used in this project.** |
| **UNVERIFIED / OPEN** | Not checked, or not known. |

I have never opened the prototype in a browser, so I make no claim that anything renders correctly, looks right, runs at a good frame rate, or responds to touch.

---

## 1. Product vision

**CONFIRMED (owner briefs)**
- FUTO Life is an immersive, game-like virtual campus for the Federal University of Technology Owerri (FUTO).
- Tagline: "Explore your campus. Find your people. Make your story."
- Realistic 3D. Not cartoonish, not low-poly, not a website, dashboard or campus directory.
- Students walk the campus, enter buildings, discover real locations, meet other students, and eventually experience campus life remotely.
- Long term: find lecture halls and departments, student hangouts, discover people, social and multiplayer interaction.
- Priority for now: accurate geography, recognisable buildings, realistic surroundings and smooth exploration. Social features come after the world is convincing.
- Mobile-first web application. The start point is the central campus entrance (the Main Gate), which the owner treats as the verified starting location.
- Real FUTO locations and authentic information. No invented places.

**CONFIRMED (working method)**
- Experimental prototypes stay separate from the production application. No production database or credentials (the owner named Supabase) are used.

---

## 2. Design decisions

### 2.1 CONFIRMED by the owner
- Realistic 3D visual direction.
- First-person and third-person cameras.
- Mobile joystick and tap-to-move; desktop keyboard and mouse.
- A persistent world with interface overlays.
- Mobile-first layout.
- Multiplayer and social discovery are the long-term plan.
- The player avatar must look like a real person; the owner disliked the first capsule-style figure.
- Replicate the tour video as closely as possible. The owner said the video shows how things really are.

### 2.2 PROPOSED by me (built, not explicitly approved)
- **Navigation:** one persistent 3D world; map, people, data and building views open as overlays, never reloading the world. Bottom sheets on mobile, a right-hand drawer on desktop.
- **HUD:** location chip top-left; camera, Map, Near and Data buttons top-right; joystick bottom-left; one contextual action button bottom-right (Enter / Leave); a proximity prompt card above it.
- **Visual tokens:** dark translucent glass UI; gold `#f2b84b` for actions and places; teal `#4cc9a6` for people and verified items; orange `#e8765a` for unverified or placeholder items.
- **First-time journey:** three intro steps, guest-first, sign-in deferred until a social action. *Design only; the intro screen exists but sign-in does not.*
- **Social layer:** presence before chat, wave, mute and report, visibility modes. *Design only. The "Near" panel is a demo.*
- **Movement feel:** acceleration and deceleration, Shift to run, camera that avoids walls, a tap-to-move marker, and automatic quality reduction on slow devices.
- **Honesty labels:** every placeholder, estimate or video-derived object carries an "Unverified" or "Placeholder" tag in the world.

### 2.3 Avatar
- **CONFIRMED:** wants a believable real-person look; multiplayer later.
- **BUILT (`avatar.js`):** procedural human figure about 7.5 heads tall, jointed limbs, walk / run / idle animation, hair styles (short, afro, long, bald), seven skin tones, outfit colours. Appearance is plain JSON so it could be synced later.
- **TESTED-HEADLESS:** 13 checks (height, proportions, limb swing, idle, presets).
- **UNVERIFIED:** how it looks. The owner has not reviewed it, and it exists only in the **local** page, not the published one. There is no networking and no character-customisation UI.

### 2.4 World-building
- **CONFIRMED:** follow the video's order and content as closely as possible; photographs of places will be supplied later.
- **AMBIGUOUS (dictated):** the owner said places the video does not cover would be provided later or not at all. I recorded this as: model only what the video shows now; defer departments in depth, lecture halls, hostels, Umuchima and Eziobodo.

---

## 3. Current prototype

### 3.1 Files (inspected 2026-10-22)

| File | Role | Status |
|---|---|---|
| `futo-life-3d.html` (78,793 B) | Main prototype. One HTML file with inline scripts; three.js r128 loaded from cdnjs. | BUILT; local copy equals the stage-2 backup |
| `futo-life-prototype.html` | First UX blockout (2D top-down canvas; Prototype / Architecture / Design-system tabs) | Superseded; kept |
| `futo-data/maingate.js` | Main Gate model | BUILT, TESTED-HEADLESS |
| `futo-data/senate.js` | Senate Building model | BUILT, TESTED-HEADLESS |
| `futo-data/videoworld.js` + `video-route.json` | Video-based route, buildings, signs, bridge, trees | BUILT, TESTED-HEADLESS |
| `futo-data/foliage.js` | Instanced leaf-card trees and shrubs, ground shadow blobs | BUILT, TESTED-HEADLESS |
| `futo-data/avatar.js` | Human avatar | BUILT, TESTED-HEADLESS, **local page only** |
| `futo-data/geozone.js`, `geo.js`, `test-fixture.geojson` | Coordinate conversion and GeoJSON import. The fixture is synthetic data near 0,0, **not FUTO**. | BUILT, TESTED-HEADLESS |
| `futo-data/route.js`, `route-layout.json` | Earlier time-based route | **Superseded** by `videoworld.js`; no longer inlined in the page |
| `futo-data/locations.json` | Location dataset (22 entries) | Data only; no verified coordinates |
| `futo-data/video-landmark-inventory.md` | Timestamped video inventory (current) | Current |
| `futo-data/video-reference-notes.md` | Earlier video notes | **Partly outdated**; still contains the unconfirmed readings later corrected |
| `futo-data/*.test.js`, `smoke.test.js` | Test suites | See 3.4 |
| `backups/` | Three page snapshots. `…BROKEN-avatar-integration.html` is kept for audit and **must not be deployed**. | Reference |

There is **no Git repository** (checked). Backups are manual copies only.

### 3.2 Publishing state
- Live artifact: `https://claude.ai/artifact/CC1P3CyiMthiJhuWEs5dFs` (the 3D prototype), plus an earlier artifact of the first blockout (inferred from tool state files; link not retained here).
- By my session record, the live page was last published **before** the avatar integration, the syntax repair and the video-data corrections. **I did not re-open the live page this session**, so treat that as unverified and compare it against the local file.
- The owner has asked that nothing be republished until the engineering audit and this handoff are coordinated.

### 3.3 What the local page does (BUILT)
- 3D scene with sun and shadows, a textured Main Gate with approach road, the Senate Building and forecourt, and the video-based route.
- Movement: joystick, WASD / arrow keys, Shift to run, tap-to-move with a marker, smooth acceleration, wall collision, camera collision.
- Camera toggle (first / third person). Map panel with "Walk" auto-walk. Demo "Near" panel with labelled simulated players. Enter / Leave for the Senate Building (placeholder interior screen only).
- "Data" panel: load a GeoJSON file with an origin, or a synthetic test zone; "Reset scene".
- Quality tiers (phone vs desktop), automatic downgrade when frames are slow, shadows that follow the player.

### 3.4 Tests (re-run this session, all passing)

| Suite | Result |
|---|---|
| `geo` | passed |
| `avatar` | 13 checks, 0 failed |
| `videodata` | 9 checks, 0 failed |
| `videoworld` | 22 checks, 0 failed |
| `senate` | 20 checks, 0 failed |
| `maingate` | 21 checks, 0 failed |
| `geozone` | 30 checks, 0 failed |
| `route` | 10 checks, 0 failed |
| `smoke` | 14 checks, 0 failed |
| Page script syntax check | OK |

**What the smoke test actually does:** runs the real page script in Node with a stubbed DOM and a stubbed renderer. It confirms the script loads (and fails on the broken backup), the loop runs, spawn is at the gate, walking north stops at the booth (z = 2.20), both vehicle openings can be walked through, the camera toggle works, the avatar's legs animate, the map auto-walk runs, and 600 more frames run without errors.

**What no test covers:** anything drawn on screen, touch input, real frame rate, memory use, or appearance on any device.

### 3.5 Known limits and incidents
- Instanced meshes were disappearing when the scene origin was off-screen; fixed by turning off culling for them.
- Two of my own edits damaged the page and were caught and repaired: a regex wiped part of `maingate.js` (restored from the page copy), and the avatar integration left one stray line that broke the page (deleted; exact diff was one line).
- An early version of the smoke test passed vacuously because its clock was not advancing; fixed and shown to detect the broken page.
- Collision uses axis-aligned boxes, so rotated buildings block more than they occupy. Ground is flat; no elevation data.
- Imported or video-derived buildings have no entrances. Only the Senate Building has Enter.
- Performance is **unmeasured**. Draw calls by module: Main Gate about 45, Senate about 47, video world about 111, and each avatar about 27 meshes.
- The page loads three.js from a CDN, so it needs an internet connection.

---

## 4. Campus reconstruction

### 4.1 Main Gate model (from one owner-supplied front photograph)
- **BUILT:** brick-patterned piers; tan wall; central security block with recessed panel, 4×2 window and a round emblem placeholder; two vehicle openings with brick lintels; black bar gate leaves; pedestrian bays; lettering "FEDERAL UNIVERSITY OF" and "TECHNOLOGY OWERRI" drawn on the wall tops; reddish paved approach road, a left asphalt lane, painted teal-and-white curbs, flowerbeds, shrubs, a lamp pole and mature trees.
- **ASSUMPTION:** every dimension is an estimate (for example a vehicle opening of about 7 m and a central block about 7.5 m wide and 6 m tall). Nothing was measured.
- **NOT DONE:** rear and side faces, interior, the real crest. The **crest was not obtained from any verified legal source**; a plain teal ring is a documented placeholder.
- The photo carries a photographer watermark and its licence is unknown, so **no photo pixels are used as textures**.
- Local position: (0, 0), outside toward +z, north = −z. **Provisional; not a real coordinate.**
- A headless test confirms the vehicle and pedestrian openings are passable and the booth, leaves, piers and bay walls are solid.

### 4.2 Senate Building model (from one owner-supplied front photograph)
- **BUILT:** buff-brick central block of three storeys with an open porch, a projecting cream first-floor box, a glazed ribbon, a brick frieze, a dark hipped roof; two 2-storey wings; forecourt tarmac; roundabout with a white curb and a Norfolk pine; flagpoles.
- **ASSUMPTION:** wing length 30 m each (the photo crops them); storey height about 3.5 m; the sign wording is unreadable, so the plaque is blank.
- **Position: PROVISIONAL (−62, −300) facing +x.** This comes only from the owner's statement that it is "on the left coming in from the gate, about a 5-minute walk". The distance and direction are **not verified**.
- Rear, sides and interior are not modelled.

### 4.3 Video-based world (`video-route.json`, `videoworld.js`)
Source: the owner's tour video (7 min 30 s). I reviewed frames at 12.5 s over the whole video, 6 s from 0:10 to 3:44 and 8 s from 3:44 to 7:20, plus three full-resolution checks. **I did not analyse the audio.**
- **ASSUMPTION:** position along the route = (video seconds − 12) × 1.3 m/s, heading straight north. The video has jump cuts and an unknown walking pace, so **all distances and every road bend are placeholders**.
- Placed: Norfolk pine (0:34), statue behind a hedge (0:52), a long bridge with steel railings over a stream (1:04–1:46), signs, drains, utility poles with wires, street lamps, cypress trees, bins, a planter, a tree avenue (3:34–4:22), and, from about 6:28, parked vans, palms and a water tower.
- 13 buildings are neutral coloured boxes with hipped roofs, each marked **unidentified** and "photos pending".

### 4.4 Confirmed sign readings (text read in the video; they identify signs, not buildings)

| Time | Sign |
|---|---|
| 0:00 | Main Gate lettering ("…ITY OF" / "TECHNOLOGY") |
| 1:52 / 1:53 | COLLEGE OF MEDICINE; SCHOOL OF HEALTH TECHNOLOGY |
| 1:58 | DEPARTMENT OF PUBLIC HEALTH |
| 2:34 | DIRECTORATE OF GENERAL STUDIES (DGS) |
| 2:46 | SCHOOL OF ENVIRONMENTAL SCIENCES, Urban and Regional Planning |
| 2:56 | SCHOOL OF ENVIRONMENTAL SCIENCES (SOES) |
| 3:22 | DEPARTMENT OF FISHERIES & AQUACULTURE TECHNOLOGY |
| 3:27 | CENTRE FOR NUCLEAR ENERGY STUDIES AND TRAINING |
| 5:12 | DEPARTMENT OF SCIENCE LABORATORY TECHNOLOGY |
| 5:36 | Stanbic IBTC Bank ATM |

Which building each sign refers to is **not established**. The side of the road for each sign is **assumed**.

### 4.5 Corrections already made
Three earlier readings were wrong or unconfirmed and were removed: "Department of Optometry", "Maritime Authority" and "FUTO Microfinance Bank". No replacement names were guessed. The older `video-reference-notes.md` still contains them.

### 4.6 Geographic research and coordinates
- **No coordinate in the project is verified.** `locations.json` has 22 entries; none has a latitude or longitude; the origin is empty; none is marked verified.
- Provisional local positions exist only for the Main Gate (0, 0) and the Senate Building (−62, −300).
- **Region only:** a 2024 MSc thesis in the FUTO repository (and a 2023 CC-BY article by the same authors) quote NIMET (2016) for a study-location extent of latitude 5°19′–5°22′N, longitude 6°58′–7°00′E. That is about 5.6 km by 3.7 km, so it cannot place a building. NIMET's source is a drought-and-flood weather bulletin.
- **Other mentions (low confidence):** a research farm at about 5°22′N, 6°59′E, 55 m elevation (garbled secondary source); a figure caption giving 05°29′06″N, 07°02′06″E for "Owerri" (the city, not the campus). General descriptions: about 25 km south of Owerri, about 10,000 acres, bounded by Eziobodo, Umuchima, Ihiagwa and Obinze, designed by Concarplan–Enplan.
- **Figure 3.1 map (thesis page 24): not seen.** The owner reports it labels the Main Gate, Senate Building, FUTO ICT Building, SMAT Complex, FUTO Mini Market, roads and the river. I could read only the caption, not the image, so none of this is verified by me. The map is dated (cites 2016) and is **historical and schematic, not current**.
- **OpenStreetMap:** I could not reach Overpass, Nominatim, Geofabrik or the repository from this environment, and web searches found nothing, so I do not know whether FUTO is mapped there.

### 4.7 Open geography questions
1. What are the Main Gate's latitude and longitude?
2. Which way is north relative to the gate, and what is the true heading of the road from it?
3. Where does the road turn, and how long is each stretch (statue, bridge, sign clusters, open ground)?
4. Where exactly is the Senate Building relative to the gate and which way does it face?
5. What are the unidentified buildings called, and which buildings do the confirmed signs belong to?
6. What is the statue, and what is the stream and bridge called?
7. Where are the FUTO ICT Building, SMAT Complex, Mini Market, hostels and lecture halls?
8. Is the thesis map usable (scale, north arrow, grid), and how much has the campus changed since 2016?

---

## 5. Important constraints
- **Geographic accuracy:** never present a placeholder position, distance or road shape as real. Every point carries its source, date, method, uncertainty and verification status.
- **Recognisable architecture:** model from photographs; do not invent details the reference does not show; use restrained detail where evidence is thin. No generic repeated building models for landmarks.
- **No invented landmarks or coordinates.** Unknown stays unknown and is labelled.
- **Historical data stays historical:** the 2016 map must never be treated as current.
- **Licensing:** third-party photos and the video are reference only. No pixels from them are used as textures. The crest may only come from a verified, legally usable source.
- **Separation:** this prototype stays separate from the production app. No production Supabase, credentials or main-codebase changes.
- **No fake multiplayer:** simulated players are labelled demo data; there is no networking.
- **Privacy:** the video shows identifiable people; no frames are stored in the project.
- **Honest verification:** do not claim browser rendering or device behaviour has been checked until someone has actually viewed it.

---

## 6. Next steps

### 6.1 Before any new implementation
1. Coordinate this handoff with the owner's engineering audit.
2. Put the project under Git (it currently has none).
3. Compare the live page with the local page and decide what to republish.
4. Have someone open the **local** page in a real browser on one desktop and one Android phone. Until then rendering is unverified.

### 6.2 Recommended next design milestone: G1, "Geo-anchored Main Gate zone (reference only)"

| Step | Output | Acceptance criteria |
|---|---|---|
| A. Evidence intake | Figure 3.1 as a full-page PNG or JPEG, at least 2,000 px on the long side (best 2,480 × 3,508), including legend, scale bar, north arrow and corner coordinates; and/or an OpenStreetMap GeoJSON export of the campus box | The map is stored as a reference file labelled historical (2016), schematic and unverified. Every label has pixel coordinates. Unreadable items are flagged, not guessed. |
| B. Control points | At least three latitude/longitude points copied from a satellite or map view, with the source named, including the Main Gate | Origin set at the Main Gate with source and date. Fit error is reported against the scale bar and any distance the owner knows. No value without a source. |
| C. Orientation | North and the gate road's heading with an uncertainty | Heading recorded in degrees with source and error. |
| D. Dry run | A table of "current provisional position" versus "evidence-based position" for the Senate Building and any other identifiable landmark | Nothing in the scene changes. The owner approves each change before it is applied. |
| E. Apply (separate step) | Scene updated behind a switch | All test suites pass, the owner views it on desktop and Android, and then it is republished. |

### 6.3 Decisions needed from the owner
- Approve or change the proposed UI and visual tokens (section 2.2).
- Confirm the meaning of the dictated statement about places the video does not cover (section 2.4).
- Supply the Figure 3.1 image and the Main Gate coordinates.
- Say whether the human avatar look is acceptable after viewing it.

---

## 7. Honesty log (corrections made during the project)
- Three video readings withdrawn (section 4.5).
- Earlier distance estimates from video time were labelled placeholders, then superseded by the same method applied more carefully; none is verified.
- Prototype statements about browser behaviour were never verified, because no browser was available.
- Several edits by me caused breakage that I found and repaired (section 3.5).

## 8. Audit fingerprints (inspected 2026-10-22)
- `futo-life-3d.html` SHA-256 prefix `1713a9ee6485d20a`, identical to `backups/futo-life-3d.stage2-video-data-corrected.html`.
- `backups/…stage1-syntax-fixed.html` prefix `249ef24b9250c8a1`; `backups/…BROKEN-avatar-integration.html` prefix `ffce848c8e96ce8d`.
- `video-route.json` prefix `8c69c9b44072c567`; `locations.json` prefix `4d6b7d8727a69108`.
- Video data: 13 building entries, 10 sign entries, 1 statue, 1 pine, 1 cypress group, 1 planter, 1 bins, 4 pole/lamp series.
