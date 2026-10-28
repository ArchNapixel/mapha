# MaPHo: Project Guide

Last updated from the project brief dated 2026-10-25.

**MaPHo** ("mapa" + PH, formerly ExplorePH) is a gamified Philippine exploration tracker.
Pitch: *Collect the Philippines, one stamp at a time.*

---

## 0. Working rules (read first, these override everything below)

### The owner decides
- The project owner has **complete control** over what goes into the program. Claude recommends; the owner approves.
- Do **not** add features, dependencies, files, screens, schema changes or config that the owner has not approved. If something seems needed, **propose it first** (what, why, cost) and wait for a yes.
- This guide is also subject to the owner's approval. Do not edit CLAUDE.md without being asked.
- When recommending, give one clear recommendation with a short reason, not a long survey. Push back on scope creep, keep the MVP small, and flag privacy issues.

### Database access is read-only, and the owner runs all queries
- Claude must **never** execute queries against the database (Neon/Postgres), whether through the Neon MCP, `psql`, Prisma, scripts or any other tool.
- That includes anything that writes or changes the database indirectly: `prisma migrate dev/deploy/reset`, `prisma db push`, `prisma db seed`, `prisma db pull`, seed scripts, or running the app against a real DB in a way that writes data.
- Every query (SELECT, INSERT, UPDATE, DELETE, DDL, migrations, seed data) is given to the owner **as copy-paste code** in a code block. The owner runs it and reports back the result.
- Migrations: Claude may write/edit `schema.prisma` and may produce migration SQL as text (for example, the SQL a migration would contain) for the owner to review and apply. Claude does not apply it.
- Reading is allowed only where the owner explicitly provides read access or pastes results. When in doubt, ask the owner to run the query and share the output.
- Never print, log or commit connection strings, secrets or `.env` contents.

### Git
- Never commit and never push. The owner does all commits and pushes. Claude may suggest a commit message.

---

## 1. Goal

Make exploring fun for locals and tourists. Users visit real places, tap a button to mark them visited, earn stamps in a digital passport, and fill in cities on a map.

- Selling to LGUs is **not** a current goal. Focus on a fun, sticky consumer app first.
- What carried over from Travel Logger: city-level map, weighted tourist spots, one-tap check-ins. No GPS, no timestamps.

## 2. Target users

| User | Why they play | How often | What keeps them coming back |
|---|---|---|---|
| Locals (students, young workers) | Discover their own city, bragging rights with friends | Weekly | Nearby spots, weekly challenges, friend leaderboards |
| Domestic tourists | Make a trip memorable, prove where they've been | A few times a year, many spots per trip | City completion, shareable trip summary cards |
| Foreign tourists | A guided list of what's worth seeing | Once per trip | Curated spots, a souvenir passport |

Locals matter most early: they can play every week, which builds the habit and the user base. A tourist-only app gets opened a few times a year and forgotten.

## 3. Core game loop

Marking a visit is one button press: no GPS, no location check, no timestamps. Works anywhere, even offline. Sharing a finished city brings in friends; partly filled cities pull players back to the next spot.

**Marking a spot:**
1. Player opens a spot and taps **"Mark as visited."**
2. The stamp appears in their passport right away.
3. City, province and region completion update.
4. Tapping again unmarks it (undo for mistakes).

**Stamp types:**
- One-tap stamp (MVP): works anywhere, no partner or signal needed.
- QR stamp (later): code shown at partner businesses/events. Harder to fake, earns a special-design stamp.

## 4. Progress, badges, leaderboards

- **City completion:** share of a city's spots stamped, weighted so a city with many spots counts for more than one with few. The city polygon fills in color as it rises.
- **Province and region completion:** roll up from the cities inside them.
- **Country completion:** headline number on the profile.

**Badges** reward specific goals, not raw counts:
- Category sets: all churches in a city, 10 waterfalls, 5 heritage sites
- Firsts: first stamp in a new region, first island
- Streaks: a new stamp every week for a month
- Challenges: limited-time themes (food crawl, heritage month)

**Leaderboards** are honor-based (stamps aren't verified), so **friends-only**. No public national board.

**Sharing:** after a trip, generate a summary card (cities, stamps, badges) sized for Instagram/TikTok stories. Main free marketing channel.

## 5. Map and spot data

- Polygons go down to **city/municipality level only**. Inside a city, completion = notable spots stamped (no barangays).
- **Boundaries:** city/municipality GeoJSON, simplified (mapshaper) to keep files small, **PSGC codes as IDs**.
- **Spots:** seeded from public sources, only the most notable per city. Each spot stores name, category, coordinates (map pin only) and a weight.
- **Towns with no famous spots:** seeded with baseline anchors (church, plaza, municipal hall) so every town is collectible.
- **Growth (later):** users suggest spots; an admin approves before they count.
- **Pilot area:** Davao City first, then Samal and the rest of Davao Region. Small and well-curated beats a thin national map.

## 6. UI: the 3D Philippines map

The main screen is an interactive 3D map shaped like the real Philippines. Each region, province and city is its own piece you can hover, click and zoom into. Pieces gain color and height as completion grows.

**How it is built**
- three.js via react-three-fiber + drei, inside Next.js, **client-side only** (dynamic import, no SSR).
- GeoJSON projected flat with d3-geo (Mercator), extruded with `ExtrudeGeometry`, one mesh per area, keyed by PSGC code.
- Hover/click via raycasting. Color and extrusion height both follow completion %.
- Load city-level meshes only when zooming into a region. Davao Region is the only city-level detail in the MVP.
- Style: tilted flat map, not a globe. Limited tilt/rotation (no free orbit), plus a reset-view button.
- Fallback: flat 2D view and list view for low-end phones and accessibility.

**Zoom levels**
- Country: whole archipelago, regions colored by completion.
- Region/province: camera glides in, provinces extruded.
- City: cities as separate pieces, side panel lists their spots.
- Spot: pin on the city piece opens a card with "Mark as visited."
- Breadcrumb (Philippines > Davao Region > Davao City) for navigating back up.

**Screen layout** (1920x1080 reference; on mobile the right panel becomes a draggable bottom sheet)
- Center (~70%): 3D map on a soft sea-colored background.
- Right panel: selection context (name, completion ring, spot list, mark buttons).
- Top bar: logo, breadcrumb, profile, passport shortcut.
- Bottom left: country completion % and latest stamp earned.

**Interaction details**
- Hover (desktop): piece lifts slightly, tooltip shows name and %.
- Mark as visited: stamp animates in, piece grows, % ticks up, confetti at 100%.
- Fog of war: unvisited pieces gray and desaturated, fill with color as you collect.

**Other screens:** sign-in, passport (stamp grid per region), badges, spot detail, trip card generator, friends/leaderboard (later).

## 7. MVP scope vs later

The MVP proves one thing: people in Davao enjoy collecting stamps enough to go out and get more.

| Feature | MVP | Later |
|---|---|---|
| Sign-in and profile | Yes | |
| 3D map with polygons that fill and rise | Yes (Davao Region) | Nationwide |
| Spot list per city with categories | Yes | |
| One-tap "Mark as visited" stamps | Yes | |
| Digital passport view | Yes | Printed passport book |
| City completion % and basic badges | Yes | Seasonal challenges |
| Shareable trip card | Yes | |
| Friend leaderboard | | Yes |
| QR stamps at partner spots | | Yes |
| User-suggested spots | | Yes |
| Rewards from local businesses | | Yes |

Anything in the "Later" column needs the owner's explicit go-ahead before work starts.

## 8. Tech stack

Mobile-first website (Next.js). Native app maybe later, once the game proves itself. **No Google Maps API.**

| Layer | Choice | Notes |
|---|---|---|
| App | Next.js (App Router, TypeScript) | One responsive site for phone and desktop |
| UI | shadcn/ui + Tailwind CSS | Radix-based copy-in components, mobile-first, themeable for passport/stamp look |
| Map | react-three-fiber + drei, d3-geo, simplified GeoJSON | Extruded polygons, one mesh per area; client-only; 2D and list fallback |
| Data fetching | TanStack Query | Caches spots and progress; no heavy global store |
| Auth | Supabase Auth | Google and email via `@supabase/ssr`; Supabase user id stored on the Prisma user record |
| Database | Neon (serverless Postgres) | Users, spots, stamps, badges; free tier for pilot; pooled connection string on Vercel |
| ORM | Prisma | Typed schema and migrations; Neon serverless driver adapter |
| Progress logic | Next.js server actions (Prisma) | Recompute completion % on mark/unmark using weighted SQL aggregates |
| Images | Supabase Storage | Spot photos |
| Hosting | Vercel | Free tier for pilot |

A stamp record holds **only the user and the spot**: no location, no time.

## 9. Future monetization (not a goal yet)

Keep in mind so early design doesn't block them; do not build them now.
- Sponsored rewards: cafés, resorts, shops offer discounts for a stamp/badge and pay for placement.
- Partner QR stamps: businesses pay to be a collectible spot with a special stamp.
- Premium passport: cosmetic stamp styles, offline maps, detailed stats.
- Printed passport book.
- Tourism partnerships: LGU tourism offices, once there's real usage data.

## 10. Risks

Biggest risk: people try it once on a trip and never open it again.

| Risk | Mitigation |
|---|---|
| Low repeat use between trips | Weekly local challenges, nearby spots for locals |
| Marking spots never visited | Accept for now (reward is personal); friends-only leaderboards; QR stamps later |
| Poor or wrong spot data | Small curated pilot area; user reports |
| Spots in risky or private places | Only public, accessible spots; report button on every spot |
| Privacy | No location or time stored; private profiles by default |
| No signal in remote areas | Queue marks in IndexedDB, sync when online; installable PWA later |
| 3D map heavy on budget phones | Simplified meshes, city detail on zoom, limited tilt, 2D and list fallback |

## 11. Open questions (owner decides)

- [x] Final app name: **MaPHo** (was ExplorePH)
- [ ] How many spots to seed for Davao City before launch
- [ ] Should friends see your marked spots by default?
