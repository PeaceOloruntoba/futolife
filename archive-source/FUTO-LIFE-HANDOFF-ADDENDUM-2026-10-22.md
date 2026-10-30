# FUTO Life: Handoff Addendum (2026-10-22)

Adds to `FUTO-LIFE-HANDOFF.md` (not replaced). **No code was changed and nothing was republished.** I did not open a browser or view the prototype; nothing here is a visual result.

## 1. Exact current source and how to preserve it

**Latest local version:** `futo-life-3d.html`, 78,793 bytes, SHA-256 prefix `1713a9ee6485d20a` (identical to `backups/futo-life-3d.stage2-video-data-corrected.html`). Supporting files are in `futo-data/` (see `FUTO-LIFE-HANDOFF.md` section 3.1).

**Live page is different (verified today by reading it):** `https://claude.ai/artifact/CC1P3CyiMthiJhuWEs5dFs`, 72,183 bytes, prefix `506fe06bdf215aa0`. It has **no human avatar**, **no Science Laboratory Technology sign**, and **still contains the unconfirmed "Maritime Authority" and "Microfinance Bank" names**. A copy is saved at `published-copy-2026-10-22/index.html`. (Reading it also created a tool-managed folder `artifacts/…`; it is a copy, not a source.)

**The page is self-contained:** every script is inlined, so `futo-life-3d.html` alone runs. It needs an internet connection for three.js r128 from cdnjs. The `futo-data/` files are the editable sources and tests; they are not loaded by the page.

**To preserve everything:** download `futo-life-source-2026-10-22.zip` (contains the local page, the first blockout, all `futo-data/` files, `backups/`, the live-page copy, both handoff documents and a SHA-256 manifest). Then check each file against `MANIFEST-2026-10-22.sha256.txt`. The project has **no Git repository**; after downloading, run `git init` and commit the unzipped folder.

**Not in the zip (keep your own originals):** the tour video (89 MB), the Main Gate photograph and the Senate Building photograph. They were uploaded to this session and may not persist. Their licences are unknown.

**To re-run the tests (verified today from a clean copy):** install Node, then in the `futo-data` folder run `npm install three@0.128.0`, then `node geo.test.js`, `node avatar.test.js`, `node videodata.test.js`, `node videoworld.test.js`, `node senate.test.js`, `node maingate.test.js`, `node geozone.test.js`, `node route.test.js`, `node smoke.test.js`. Today's result: all pass.

## 2. Browser-testing checklist

**What I tested (headless Node only, no browser):** the page script loads without throwing; the loop runs; spawn at (0, 7); walking north from spawn is stopped by the booth; both vehicle openings can be walked through; the camera toggle function works; the avatar's legs animate; the map auto-walk runs; 600 further frames without errors; and all other suites pass.

**What I did NOT test:** anything on screen, appearance, touch, real frame rate, memory, battery, real devices, the live page in a browser, or the CDN load.

**You test: desktop (Chrome or Edge)**
1. Open the local `futo-life-3d.html` (internet on). Press F12 and open Console. Note any red errors.
2. A 3D scene appears (not blank). You start in front of the gate. The gate lettering shows over both side openings, and a booth with a window and a round emblem is in the middle.
3. W A S D or arrow keys move you; Shift runs; dragging the mouse looks around; the avatar walks with swinging arms and legs.
4. Walk straight at the booth: you must be stopped. Walk to the right opening (about 7 m right of centre) and through it: you must pass. Repeat on the left.
5. Click the camera button (or press C): first person hides the avatar; third person shows it.
6. Click Map, then Walk beside "Senate Building": you walk there while the world keeps running. Near the Senate an Enter button appears; Enter shows a placeholder screen; Leave returns.
7. Click Near: simulated people are labelled DEMO. Click Data: the panel opens; "Load synthetic test zone" loads a test zone; "Reset scene" reloads.
8. Note whether motion feels smooth, and take a screenshot of the gate.

**You test: Android (Chrome)**
1. Copy the HTML file to the phone and open it in Chrome (internet on), or ask me for a hosted link in the next session. Note the phone model and Chrome version.
2. The left joystick moves you smoothly; dragging elsewhere on the screen looks around; tapping the ground walks you there with a ring marker.
3. Top-right buttons (camera, Map, Near, Data) respond to a tap; the action button appears near the Senate door and works.
4. Rotate the phone: the layout stays usable. Check text is readable.
5. Check frame rate by feel, heat after two minutes, and any error or blank screen. Record a screen capture if something is wrong.

**Record:** device, browser version, pass or fail for each step, and screenshots of any problem.

## 3. Five most important visual shortcomings
*Judged from how the models were built and the reference photographs, not from viewing a render.*

1. **The 13 video buildings are plain coloured boxes with hipped roofs.** A student would not recognise any of them as a specific FUTO building; they only match colour, storeys and roof type.
2. **The Main Gate and Senate Building rest on one photo each.** Every dimension is estimated; rear, sides and the Senate wings (30 m assumed) are guesses; the crest is a placeholder; the Senate sign plaque is blank.
3. **The land does not follow the video.** The ground is flat, the road is straight, the bridge sits at ground level with no valley, and all verges are uniform.
4. **Surfaces are procedurally drawn textures.** Brick, tan paint and windows repeat in tiles, windows are flat decals, and the lettering is flat text, which risks the "game demo" look the owner rejected.
5. **Vegetation, light and the avatar are simplified.** Trees are leaf cards with no species detail, the sky is a gradient, ambient occlusion is faked with blobs, and the avatar's skin and clothes are simple shaded shapes.

## 4. Landmark evidence status

**Confirmed identity**
- **Main Gate:** lettering is legible in the video (0:00) and in the owner's photo. The *model* is still estimated.

**Owner-identified (no legible text)**
- **Senate Building:** identified by the owner and shown in the owner's photo. I could not confirm it from on-image text.

**Sign-only evidence (the sign is confirmed; the building behind it is not)**
College of Medicine (1:52), School of Health Technology (1:53), Department of Public Health (1:58), Directorate of General Studies (2:34), School of Environmental Sciences with Urban and Regional Planning (2:46), SOES (2:56), Department of Fisheries & Aquaculture Technology (3:22), Centre for Nuclear Energy Studies and Training (3:27), Department of Science Laboratory Technology (5:12), Stanbic IBTC Bank ATM (5:36).

**Unidentified**
- The statue (0:52); the stream and bridge (1:04–1:46).
- The 13 buildings at 0:22, 1:28, 2:04, 2:20, 2:46, 2:52, 2:56, 3:13, 4:22, 4:35, 5:12, 5:40 and 6:02.
- Norfolk pine, cypress trees, bins, planter, vans, palms and a water tower.

**Placeholder**
- Old placeholder buildings A–D (hidden in the scene; code remains); the Senate interior screen; the Senate sign plaque; the gate emblem; the simulated people in the Near panel; the synthetic GeoJSON test zone.

**Not started (in `locations.json`, no model, all unverified):** Football Roundabout, Main Library, E-Library, Old SEET Head, FUTO ICT, Old ICT, Hall of Mercy, Hall of Excellence, 500-capacity lecture theatre, SEET, SOSC, SMAT, SOES/SOET area, SICT, GST, Bukataria, Sunic Eatery, FUTO Cafe, FUTO Market, hostel zones. (You report the thesis map labels FUTO ICT, SMAT and the Mini Market; I have not seen it.)

**Provisional coordinates (local scene units, not geographic)**
- Main Gate (0, 0); spawn (0, 7); Senate Building (−62, −300) facing +x. That is about 306 m from the gate in a straight line. Your "about 5 minutes' walk" would be about 390 m at 1.3 m/s, so the two do not agree (unexplained).
- No latitude or longitude is verified anywhere. The origin is empty.

**Provisional distances along the video route** (all = (video seconds − 12) × 1.3 m/s, straight north, lateral offsets chosen by me)

| Feature | Time | Distance |
|---|---|---|
| Norfolk pine | 0:34 | 29 m |
| Statue | 0:52 | 52 m |
| Bridge | 1:04–1:46 | 68–122 m |
| College of Medicine / Health Technology / Public Health signs | 1:52–1:58 | 130–138 m |
| DGS sign | 2:34 | 185 m |
| SOES-area signs | 2:46–2:56 | 200–213 m |
| Fisheries and Nuclear Energy signs | 3:22–3:27 | 247–254 m |
| Science Laboratory Technology sign | 5:12 | 390 m |
| Stanbic ATM | 5:36 | 421 m |
| Route end | 7:20 | 556 m |

## 5. Handoff completeness

**Present:** `FUTO-LIFE-HANDOFF.md`, this addendum, the video inventory, the location dataset, the corrected video data, all tests, backups, the live-page copy and a manifest.

**Missing, or still to do**
- No Git repository and no `package.json`; test steps are written above only.
- Figure 3.1 map image (thesis page 24); I have never seen it.
- Main Gate latitude and longitude; control points; an OpenStreetMap export.
- Side and rear photos of the Gate and Senate Building; the licensed crest; licences for the owner's photos.
- The original video and photos are not stored in the project.
- Real-device and browser test results (yours).
- The link to the first blockout artifact (the first prototype, not retained here).
- `video-reference-notes.md` is older and still lists the unconfirmed readings; use `video-landmark-inventory.md` instead.
- The live page is behind the local page and needs a decision to update it.

## 6. Single most valuable next task
**G1 evidence intake and dry run (details in the handoff, section 6.2).** Acceptance criteria:
1. Figure 3.1 supplied as a PNG or JPEG of at least 2,000 px on its long side, with legend, scale bar, north arrow and corner coordinates visible.
2. A new reference file lists every readable map label with pixel coordinates and a "readable / unreadable" flag, marked historical (2016), schematic and unverified.
3. The Main Gate's latitude and longitude plus at least two more control points are recorded, each with a named source and date.
4. A dry-run table compares the Senate Building's current provisional position (−62, −300) with the evidence-based one, with an uncertainty and the reason for any difference.
5. Nothing in the scene changes and nothing is republished until you approve.
