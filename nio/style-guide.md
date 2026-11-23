# NIO ET9 HMI study · Style guide

**Source of truth for every screen.** Generated from the approved hero
(`nio/design/hero-lavender.html`, Drive: Navigation, Lavender Light).
Build each new screen from this document instead of copying the hero by eye.
If a screen needs something that isn't covered here, add it to this document first, then use it.

---

## 1. Canvas and layout

| Item | Value |
|---|---|
| Target hardware | NIO ET9 centre screen, 15.6", 2880 × 1800 |
| Design canvas | **1440 × 900 pt** (rendered @2×) |
| Status bar | top 0, height **56**, side inset **36** |
| Content area | top **64**, bottom **128**, side inset **24** → 1392 × 708 |
| App pane / context pane | **2 : 1** split, gap **20** (≈ 915 × 708 and 457 × 708) |
| Context pane stack | cards, gap **16** |
| Dock | bottom **16**, height **100**, side inset **24**, inner padding 14 |
| Panes can swap sides | only when parked (Edit layout) |

**Spacing scale (pt):** 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48.
Use 16 between related items, 20–24 between groups, 24 inside cards.
Nothing ad hoc: if a value isn't on the scale, round it to the nearest one.

**Touch targets:** minimum **56 × 56**, standard **64 × 64**. The primary action in a card (play/pause) is **76**.

---

## 2. Typography

Families: **Red Hat Display** (numbers, headings) · **Red Hat Text** (labels, body).
All numbers use `font-variant-numeric: tabular-nums` so they don't jump while updating.

| Token | Family / weight | Size | Use |
|---|---|---|---|
| `display-l` | Display 500, −1% tracking | **40** | turn distance |
| `display-m` | Display 500 | **32** | climate temperature |
| `title-l` | Display 500 | **28** | trip bar values (ETA, min, km) |
| `metric` | Display 500 | **24** | card metrics, speed readout |
| `title-m` | Text 500 | **22** | media title |
| `clock` | Display 500 | **21** | status bar time |
| `body-l` | Text 500 | **20** | primary row text |
| `body-m` | Text 400, `t2` | **17** | secondary lines, street names, buttons in segmented controls |
| `body-s` | Text 400, `t2` | **15** | supporting lines (“then left onto…”, card meta) |
| `caption` | Text 400, `t2` | **14** | units under metrics |
| `label` | Text 500, caps, +8% tracking, `t3` | **13** | card titles (NOW PLAYING, TRIP), dock labels |
| `map-street` | Text 600, `#7a7690` with land-colour halo | **11.5** | street names on map |
| `map-district` | Text 600, caps, +16% tracking, `#a29eb5` | **11** | district names on map |

Rules: sentence case everywhere except `label` and `map-district`.
Line length in cards ≤ 32 characters; truncate with an ellipsis instead of wrapping in list rows.

---

## 2a. Hierarchy study (Apple HIG)

Reference: Apple Human Interface Guidelines, *Typography* and *Buttons*.
- Apple: “Adjust font weight, size, and color as needed to emphasize important information and help people visualize hierarchy.”
- Apple’s own text styles are almost all **Regular**; only *Headline* is Semibold. Hierarchy comes mainly from **size and colour**, not weight.
- Apple: avoid Ultralight, Thin and Light weights; minimise the number of typefaces.

Applied here:
1. **Regular (400)** for all body text, rows, numbers and large titles.
2. **Medium (500)** only for one headline per card (`h3`: song title, plan title), button labels and the selected item.
3. Secondary information steps down in **colour** (`t1 → t2 → t3`), not weight.
4. One focal point per pane (Home: the next plan). Everything else sits back: hairline dividers instead of filled rows, grey icons.
5. Buttons follow Apple’s prominence levels: **filled** (`ink`, once per view) → **tinted** (`sel`, e.g. Go) → **plain/secondary**.

## 3. Colour · Lavender Light (Day)

| Token | Hex | Role |
|---|---|---|
| `bg` | `#f3f2f8` | screen background |
| `s1` | `#ffffff` | cards, floating panels |
| `s2` | `#eceaf3` | inset controls, hover |
| `s3` | `#dcd9e7` | placeholders, dashed outlines |
| `line` | `#dad7e4` | 1 pt card borders |
| `t1` | `#1f1c29` | primary text (soft plum-black, never pure black) |
| `t2` | `#625f74` | secondary text, idle icons |
| `t3` | `#9794a8` | labels, tertiary |
| `ink` / `on-ink` | `#2d2840` / `#ffffff` | **A · Deep plum: the one primary action per view** (play, Save as Custom) |
| `sel` / `on-sel` | `#cddcf7` / `#22304f` | **E · Morning sky: selected state** (dock tab, gear, Serene/Map/Car, drive mode, chips) |
| `sel-hover` | `#bfd1f3` | hover on a selected item |
| `route` | `#7a6bf2` | **guidance only**: route line, turn tile, active lane, destination pin, focus ring |
| `route-soft` | `#e7e3fd` | route halo / tinted backgrounds |
| `route-done` | `#c9c4dc` | driven part of the route |
| `warn` | `#d94a4a` | speed-limit ring and real warnings only |
| `open` | `#e0605a` on `#fde3df` | open doors, frunk and boot (with soft red glow) |
| `heat` / `cool` | `#e2895c` / `#6f9be0` | seat heating / ventilation, warm and cool climate tints |
| Drive-mode colours | Eco `#7fbf8e` · Comfort `#8ea7e6` · Sport `#e2895c` · Snow `#8fc7de` · Custom `#a99fd0` | knob arc, indicator dot, SkyRide caliper |
| Map | land `#eeedf4`, road `#ffffff`, minor road `#f9f8fc`, road edge `#d8d5e3`, building `#e3e1eb`, park `#dde8de`, green `#e4ebe4`, water `#d8dff3`, rail `#c9c5d8` |

**Usage rules**
1. Violet means “where to go”. Never use it for selection, toggles or decoration.
2. Morning sky (`sel`) means “selected”. Deep plum (`ink`) means “do this” and appears **once per view** (Apple: one prominent button, the rest tinted or plain). Pure black is not used anywhere.
3. Red is reserved for limits and warnings, never for branding.
4. No gradients on UI chrome. The only gradient is the media placeholder tile.

### Night (Lavender Dark) · provisional
Same roles, same names, to be checked against the hero before Batch 1 Night:
`bg #0f0e13`, `s1 #1a1820`, `s2 #24212c`, `s3 #322e3c`, `line #2c2935`,
`t1 #f2f1f6`, `t2 #a9a5ba`, `t3 #716d82`, `ink #f2f1f6` / `on-ink #111014`,
`route #9b8ffa`, `route-done #4a4560`, map land `#16151b`, road `#2a2733`, building `#1f1d26`, water `#1c2233`, park `#18201b`.

**Theme switching:** Settings › Display › Appearance = **Auto · Light · Dark**
(Auto follows sunset/sunrise and tunnels). The portfolio page also has a Light/Dark toggle above the frame.
Every colour in markup must be a token (`var(--…)`) so that switching theme only swaps the token set.

---

## 4. Radii, borders, elevation

| Token | Value | Use |
|---|---|---|
| `r-pane` | **28** | app pane, dock |
| `r-card` | **22** | cards, floating panels |
| `r-ctl` | **16** | 64 pt buttons, End button |
| `r-seg` | 18 outer / 13 inner | segmented controls |
| `r-tile` | 18 | turn tile, dock items |
| `r-chip` | 999 | chips |
| `r-small` | 10 outer / 7 inner | gear selector |

- Cards **on the background**: 1 pt `line` border, no shadow.
- Panels **floating on the map**: no border, `shadow = 0 10 30 rgba(36,30,72,.10), 0 2 6 rgba(36,30,72,.06)`.
- App pane: 2 pt inner border `#cfcbdc` so the map doesn't blend into the background.
- Only floating elements get shadows. Max one elevation level.

---

## 5. Icons

Material Symbols **Rounded**, optical size 24, weight 400, grade 0.
Outline when idle, **filled when selected/active**. Sizes: 22 (status, card headers), 26–28 (controls), 38 (play), 48 (turn tile).
Idle icon colour `t2`; selected icon on `ink` uses `on-ink`.
No brand logos, mascots or emoji.

---

## 6. Components (hero inventory)

| Component | Spec |
|---|---|
| Status bar | Gear selector (P R N D, D on `ink`) · drive-mode chip · speed `metric` + “km/h” `caption` · speed-limit sign 36, 4 pt `warn` ring · centred `clock` · connectivity · range + battery |
| Next-turn panel | floating, 452 wide, padding 20/22; turn tile 72, `route` fill, white icon 48; `display-l` distance + `body-m` street; lanes strip on `s2` (active lane `route`), “then …” `body-s` |
| View switch | segmented Calm / Map / Car, 52 high, selected on `ink` |
| Map controls | 64 buttons, right 20 / top 20, gap 12; recentre button bottom-right |
| Trip bar | floating, ETA · remaining · distance in `title-l` + `label`; End button on `s2`, `r-ctl` |
| Media card | `label` header + output icon; art tile (`r` 16, placeholder named by slot); `title-m` + `body-m`; progress 6 pt on `s2` with `ink` fill; prev / play (76, `ink`) / next |
| Metric card | `label` header + `body-s` meta; three metrics `metric` + `caption` |
| Dock (bottom bar) | climate L/R temperature (tap the number → Climate; − / + steps 0.5°) · six app items (Home, Nav, Media, Phone, Car, Apps) 68 wide with labels, selected on `sel` · divider · **comfort group** of four icon buttons, 56 wide, label shown only while its place is open: NOMI, Seats (heat/vent bars, orange = heating, blue = ventilating, hidden when off), Climate (fan), Defrost (glows warm when on) · divider · volume slider 150 · passenger temperature |
| Bottom-bar gestures | **Tap = quick action, hold (650 ms) = its menu.** NOMI: tap opens the NOMI box, hold opens Settings › NOMI. Seats: tap opens the seat-temperature panel, hold opens Car › Seats. Climate: tap opens the Climate screen, hold opens Car › Climate. Defrost: tap toggles front defrost, hold opens Climate. Volume: tap mutes, hold opens Settings › Sound. |
| Destination pin | `s1` pill, `route` 28 square “P”, name `body` 14 + ETA 12; flips to the left near the right edge |

---

## 6a. Interaction patterns (v2)

| Pattern | Spec |
|---|---|
| Nav views | Segmented **Serene · Map · Car** (renamed from Calm). Serene fades the map to 18 % and hides labels and map buttons, keeping route, car and the next turn. Car shows the live surround view. |
| Media player | Walkman-inspired: modern layout + cassette reels that turn only while playing + a 16-bar level meter (scales with volume). Draggable progress slider; volume slider under it. |
| Volume | Two sliders, one in the player and one in the dock; always in sync. Speaker icon mutes and restores. |
| Tap sound | Short soft click on every control, softer tick while dragging sliders. **On by default**; page-level “Tap sounds on/off” switch, remembered per browser. |
| Sound settings | Own page at Settings › Sound, also opened by long-pressing the dock volume and by the Sound tile in Car › Quick controls. Separate levels for media, navigation, calls, NOMI, ringtone, chimes (floor 30 %) and touch sounds, each with a preview; 6-band equaliser (60 Hz–8 kHz, ±12 dB) with nine presets and a live curve; LYRA 8.2.4.8 cabin map (35 speakers, 2,800 W) with a draggable sweet spot, five listening zones, per-seat headrest privacy, Dolby Atmos / Dirac badge and road-noise cancellation meter; also in Car › Sound; nav-voice and speed-volume rules; lock and welcome sounds with preview. |
| Navigation: end and Where to? | The ✕ End button on the trip bar ends the route at once with a 5 s “Route ended · Undo” toast. With no route, all three views go to free drive: route line, pin, turn card, lane tray and trip bar fade out, and a “Where to?” card sits top-left (search bar with keyboard and NOMI mic icons, three favourite chips). Tapping it opens categories (Charging, Swap, Parking, Coffee, Food), favourites and recents; the keyboard icon pops an on-screen keyboard and results filter as you type. Picking a place shows a preview (drive time, distance, arrival); Start restarts the drive to that place. The map search icon opens the same panel during a route. |
| Car drawing | **One ET9 top view everywhere** (Quick controls, Tyres, Seats picker, Climate zones; Sound field uses a lighter version): own drawing from published dimensions (5,325 × 2,017 mm, 3,250 mm wheelbase) and top-down photo cues: blunt wide nose, wider front fenders and rear haunches, roof removed (cutaway) showing dashboard with floating screen and rectangular wheel, Executive Bridge console front to rear, two front seats, two larger rear seats in a wrap-around bulkhead, full-width tail light. Seats carry a soft blurred shadow. |
| Wide pages | On every Car page and on the Climate screen the music and battery cards slide away (600 ms) and the page uses the full width; they return on Home, Nav, Media, Phone and Apps. |
| Quick controls | Three columns: **left** lock card (tap = lock/unlock; chevron folds the four-door list with Open/Close per door) and *Close all and lock* · **centre** the car, every part tappable · **right** Frunk, Boot, Charge port buttons, then Windows (summary, opens the window menu), Mirrors, Sunshades (Closed · Left · Right · Both), Lights (Auto · On · Off), Child lock, Sound. Open doors swing out on their hinge, turn red with a soft red glow, and get a leader line with “Open”; frunk and boot lift and glow red; the charge port (left rear) opens with a green glow; mirrors fold when locking. Sunshades: the glass roof fades in, a pleated shade slides back (1.4 s) with a sun glow, and the roof fades away again when both are closed. The car will not lock while anything is open. Opening a door with Easy entry on lowers the body 50 mm. |
| Windows menu | Floating card over the car: All windows (with Vent 2 cm), Front left, Front right, Rear left, Rear right; each row = name · horizontal slider 0–100 % · value (Closed / Vent / % / Open) · Close and Open buttons. Window strips on the car fade with the opening. |
| Tyres | Same car; four pressure/temperature cards beside the wheels (green / amber); status card, recommended cold pressures (2.9 / 3.0 bar, 265/40 R23), *Reset after inflating*, *Demo: slow leak* (rear right drops to 2.4 bar and turns amber). |
| Seats | Car › Seats (tap the Seats button for quick temperature; hold for this page). Tab bar like Sound: **One touch · Position · Comfort · Massage · Memory**, each scrolls to its section; section titles name the seat (“Comfort · Driver”). One touch: full-height seat picker (same car drawing) and a 2 × 2 grid — Driver: Drive · Relax · Easy entry · Rest stop; Passenger: Upright · Relax · Easy entry · Child seat; Rear left: Work · Lounge · Sleep · Child seat; Rear right: Work · Lounge · Sleep · Executive. Sleep/Executive keep the thigh support level and extended. Position: Adi’s four-part seat render with real limits (front recline 19–40°, rear 19–45°), ring readout and − / + steppers; the floor shadow follows the seat. Comfort: one **warm–cool control** per seat, Cool 3 · 2 · 1 · Off · 1 · 2 · 3 Warm (blue ventilates, orange heats, never both), armrest heating. Massage: five programmes, backrest areas, intensity, speed, live preview. Memory 1–3 per driver. |
| Seat quick panel | Frosted panel above the bottom bar with the warm–cool control for Driver and Passenger and *All seat settings ›*; closes on outside tap. |
| Climate | Own screen (bottom-bar Climate or a temperature tap) and the same live panel inside Car › Climate. Left: zones on the car drawing (tap a seat; warm/cool tint and moving airflow strands; Sync all zones; Lock rear controls). Right, tab bar: **Temperature** (large value LO 16 – HI 28 °C, arc fan dial 1–7 with a spinning fan, Auto, A/C, Recirculate, Max cool, Max heat, front and rear defrost) · **Airflow** (side-view tiles: windscreen, dashboard, steering wheel, seated person; dotted air drifts from the vents; drag-to-aim vent pad with Focus / Diffuse / Sweep, smart targeted cooling) · **Air quality** (inside/outside PM2.5 gauges, purifier, ionizer, auto recirculation) · **Comfort** (fragrance with three scents and intensity, steering-wheel heat, seat heating follows climate, ready-at time and days, keep climate on: Off / Pet / Camp) · **Fridge and table** (Cool −2…10 °C / Warm 35…55 °C, rear tray table). |
| Drive modes | Car › Driving. **Drive mode** card: soft lavender rotary knob, indicator dot points up at the mode; a coloured arc runs over the knob from Eco to Custom; all five names always visible, the selected one bold. Mode colours: Eco `#7fbf8e`, Comfort `#8ea7e6`, Sport `#e2895c`, Snow `#8fc7de`, Custom `#a99fd0`. Drag or tap. **SkyRide** card: wheel in its arch (aero rim, low-profile tyre, caliper in the mode colour); the body moves with ride height in 2 s. Heights stay inside the real SkyRide range (+40 / −50 mm): Eco −10, Comfort standard, Sport −15, Snow +30, Custom standard; manual Auto · Low −20 · Standard · High +20 · Max +40. Settings: five segmented rows, view-only for presets, editable in Custom with *Save to Emma’s profile*. Driving assists below. |
| NOMI settings | Settings › NOMI (hold NOMI): wake word, continuous conversation, driver-only listening, voice Calm / Bright / Deep, speaking speed, proactive suggestions, dashboard orb. |
| Prototype routing | Bottom bar and the status-bar gear switch screens; side menus switch pages; the right-hand pane (player + context card) stays put except on Car and Climate pages (see Wide pages). Settings opens from the gear and from Apps. |
| Phone | Favourites, Recents, Keypad, Messages. Call = green (`#2fae6a`), End = warning red; this is the one deliberate exception to the colour roles, matching platform convention. Call screen: Mute, Keypad, Speaker, End, live timer. |
| Apps | CarPlay / Android Auto-style grid; app views open inside the app pane with a back button. Games (Chess, Sudoku, Trivia) are labelled “playable when parked”. |
| NOMI | Bottom sheet with a breathing orb (generic, not NOMI’s face), suggestion chips and a scripted conversation whose actions change the car (seat heat, music, parking booking). |
| Blind spot | Indicator → cyclist detected: red map edge + one red icon, camera opens in the side pane and the player compacts; after 4 s it reverses. |

## 7. States

| State | Treatment |
|---|---|
| Default | as specified |
| Hover (pointer only) | background `s2` (selected items: `sel-hover`) |
| Pressed | scale **0.96**, 140 ms + tap sound |
| Selected | `sel` background, `on-sel` text, filled icon |
| Focus (keyboard) | 3 pt `route` outline, 2 pt offset |
| Disabled | `t3` text/icon, no background change, not tappable |
| Guidance active | `route` (only in navigation contexts) |
| Warning | `warn` ring or text + icon; never colour alone |

---

## 8. Motion

| Item | Value |
|---|---|
| Easing (all controls) | `cubic-bezier(.2,.8,.2,1)` (fast start, soft landing) |
| Hover / colour | **240 ms** |
| Press | **140 ms**, scale 0.96 |
| Panels, view changes | **600 ms** |
| Physical moves | sunshade 1.4 s, ride height 2 s (matches the car), doors and mirrors 600 ms |
| Rule | one easing and these three durations everywhere in the HMI; no instant state changes |
| Map | heading-up; rotation eases toward the route bearing (look-ahead 25 m back / 70 m ahead); car fixed at (250, 540) in the map pane |
| Live demo | drive replays at 2.5× real time; respects `prefers-reduced-motion` (static frame) |

---

## 9. Content and data

- Real, consistent data: Emma (driver), Pierre, Ashish; Luxembourg City; route Gare → Parking Trois Glands (OSRM); live weather/air quality from Open-Meteo.
- ET9 figures are kept true to published specs; design-adjusted values carry the disclaimer.
- Payment is always “Saved payment method”, never card numbers.
- Placeholders are named by slot: `media/album-01_starman_david-bowie`, `people/driver-01_emma`.
- Map credit “Map data © OpenStreetMap contributors” on every map view.

### Anti-AI checklist (run before publishing a screen)
1. Every value comes from a token in this document.
2. One accent meaning per colour (violet = guidance, sky = selection, ink = the one primary action, red = warning or open, orange/blue = heat/cool).
3. No decorative gradients or random emoji. Glows only to show a physical state (open door, charge port, sun through the roof); frosted glass only for panels floating over content.
4. No lorem ipsum or invented brand names; data is real or clearly named placeholders.
5. Alignment checked on the 4-pt grid; numbers are tabular.
6. Copy is short, sentence case, and says what happens (“End”, not “Terminate navigation session”).
7. Icons from one set, one weight.
8. Interaction states exist for everything tappable.

---

## 10. Files

| File | Purpose |
|---|---|
| `nio/design/hero-lavender.html` | approved hero (reference implementation) |
| `nio/design/nav-map.js` | heading-up map engine |
| `nio/map/lux-map.js` | Luxembourg base map data (OSM, 1 px = 3.4 m) |
| `nio/wireframes/` | approved low-fidelity layouts (Batches 1, 2a, 2b) |
