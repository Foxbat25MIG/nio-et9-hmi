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
| Dock | climate L/R (`display-m` + side label) · app items 86 × 76, `r-tile`, selected on `ink` · divider · NOMI · user shortcut (dashed `s3` outline) |
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
| Drive modes | Tap a mode: values change and briefly highlight. Only **Custom** is editable (segmented options per setting) with **Save as Custom** → toast “Saved to Emma’s profile”. Custom is stored **per driver**. |
| Prototype routing | Bottom bar and the status-bar gear switch screens; side menus switch pages; the right-hand pane (player + context card) stays put. Settings opens from the gear and from Apps. |
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
2. One accent meaning per colour (violet = guidance, ink = selection, red = warning).
3. No decorative gradients, glows, glassmorphism or random emoji.
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
