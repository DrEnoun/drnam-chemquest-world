# DR NAM’s CHEMQUEST

**Chemistry with Dr. NAM** · a pixel-art chemistry game for phones.

Travel across a map of six islands. Each world teaches one chemistry topic with a different style of game. Clear a world to earn its badge and open the next. Played in a phone browser, with no login and no app to install.

| # | World | Game | Topic | Status |
|---|---|---|---|---|
| 1 | Lab Meadow | Memory match | Names, formulae and shapes | **Playable** (4 levels) |
| 2 | Orbital Ruins | Push puzzle | Electron configuration | **Playable** (4 levels) |
| 3 | Periodic Falls | Pop and shoot | Periodic table (families, groups, periods) | **Playable** (4 levels) |
| 4 | Trend Peaks | Platform jumper | Periodic trends (radius, ionisation energy, electronegativity) | **Playable** (4 levels) |
| 5 | Bond Glacier | Drag and drop | Lewis structures and VSEPR | **Playable** (4 levels) |
| 6 | Ion Diner | Diner dash | Ionic compounds and formulae | **Playable** (4 shifts) |

Friendly molecule monsters (H₂O, CO₂, NH₃, CH₄, O₂ and NaCl) roam the map. Tap one to learn its real shape and bonding.

Made for Dr. Nur ’Ainun Mokhtar’s PHD115 Fundamental of Chemistry class at UiTM, and for STEM tours, open days and outreach.

## Play

Open the game link on a phone (Chrome on Android works best). Tap a pin to travel to a world, then tap **Play**.

- **Hearts, coins, XP and stars:** every level has 3 hearts; stars come from the hearts you keep. Progress saves on your device.
- **Wrong answers explain the rule** in the Dr. NAM bubble instead of just saying "wrong".
- **Works offline** after the first visit, so it is safe to use where the wifi is poor. Add it to the home screen to install it.

## Music and sound effects

Three short original music loops are generated in the browser (no audio files): one for the map and menus, a livelier one for Ion Diner, and a gentle music-box one for Lab Meadow. **Music** and **Sound FX** have separate on/off buttons in the top bar, so players can keep the Sound FX without the music, or the other way round. Each choice is saved on the device. Music starts after the first tap (browsers do not allow sound before that) and pauses when the tab is hidden.

The notes are plain data in `js/music.js` (`TRACKS`), and `npm test` checks that every note and chord is in the key.

## Presenting on a projector or big screen

The game adapts to the screen it is on:

- **Wide screens (16:9, 16:10, 3:2: laptops, projectors, TVs):** the map sits on the left and the world card, avatar, topics and badges beside it. Ion Diner shows the scene on the left and the counter, tray and **Serve** button on the right. The memory cards fill the window. Nothing needs scrolling, and text and buttons grow with the window height so they can be read from the back of a room.
- **Square or upright screens (4:3 projectors, tablets held upright):** one column, scaled up for readability.
- **Phones:** one column, with the Serve button pinned to the bottom of the screen. In Orbital Ruins the whole screen fits the display and you **swipe anywhere** to move (keep dragging to keep walking); the optional **Arrows** button shows an on-screen pad.

Press **Full screen** (top right of the map) before presenting. Click with a mouse or a presentation clicker, or touch a touchscreen board. Tab and Enter also work.

## Run it yourself

No build step. Any static file server works:

```
npm run serve        # then open http://localhost:8080
```

To publish on GitHub Pages: **Settings → Pages → Build and deployment → Deploy from a branch → `main` / root → Save**. The game then lives at `https://<username>.github.io/drnam-chemquest-world/`.

## Edit the content (no code needed)

All questions, levels and worlds are in `data/`:

| File | What it holds |
|---|---|
| `data/diner.json` | Ion Diner: the ions and every shift (orders, customers, patience, tips, boss) |
| `data/memory.json` | Lab Meadow: every card set, level and the timed boss |
| `data/falls.json` | Periodic Falls: every round (the sign, the rule, how many bubbles) |
| `data/bonds.json` | Bond Glacier: the molecules (layout, answer, shape, fact) and every level |
| `data/trends.json` | Trend Peaks: element values and every climb (the property, the direction, the elements) |
| `data/elements.json` | The 45 elements used (group, period, block, category, family) |
| `data/orbitals.json` | Orbital Ruins: each level's element, board layout and tip |
| `data/worlds.json` | The map: world names, topics, colours, pin positions, badges, tips |

Formulae in Ion Diner are worked out from the ion charges, so they cannot be typed wrongly. In the memory game, formulae are written like `SO4^2-` and shapes come from a fixed list with their bond angles.

After editing an Orbital Ruins level, `node tools/solve-orbital.mjs` prints a shortest solution, or tells you the layout cannot be solved. After editing, run the checks:

```
npm test
```

The tests compare every name, formula, shape and bond angle against an independent answer key, and check the game rules, unlocks and badges. If a formula is wrong, the test fails and says which one.

When files change, rebuild the offline cache list so phones pick up the update: `npm run sw`.

More detail on adding Ion Diner shifts and memory levels is in [`docs/EDITING.md`](docs/EDITING.md).

## How it is built

- Plain HTML, CSS and JavaScript. The pixel art is drawn in code on canvas, so there are no image files for the world, avatar or monsters.
- `js/overworld.js` and `js/scenery.js`: the map. `js/monsters.js`: the molecule monsters.
- `js/diner.js` and `js/diner-logic.js`: Ion Diner. `js/memory.js` and `js/memory-logic.js`: Lab Meadow.
- `js/falls.js` and `js/pop-logic.js`: Periodic Falls (the bubbles and the rules for each round).
- `js/bonds.js` and `js/bond-logic.js`: Bond Glacier (drag and drop board, Lewis checker, VSEPR shapes).
- `js/peaks.js` and `js/trend-logic.js`: Trend Peaks (the ledges, hopping, and the trend rules and explanations).
- `js/orbital.js` and `js/orbital-logic.js`: Orbital Ruins (the board and the Aufbau, Hund and Pauli rules).
- `js/progress.js`: unlocking worlds and earning badges. `js/avatar.js`: the avatar creator.
- Game rules live in the `*-logic.js` and `progress.js` files, with no screen code, so they can be tested in Node.
- Style: the Dr. NAM design system in `brand-kit/` (night and day themes, League Spartan and Questrial, electric-lime accent).

## Credits

Created by Chemistry with Dr. NAM (Dr. Nur ’Ainun Mokhtar, UiTM Cawangan Pulau Pinang). The avatar is a generic student-scientist; Dr. NAM appears only as her official badge.

This game grew out of the [Dr. NAM Virtual Secret Lab](https://github.com/DrEnoun/dr-nam-virtual-secret-lab) project.

## Arcade and Zen modes

The button at the top of the map switches between two ways to play (saved on the device):

- **Arcade** (default): worlds and levels unlock one by one. World 2 opens when World 1 is cleared, and so on.
- **Zen**: every world and every level is open, so players can play whichever they like (useful for STEM tours, demos and revision). Stars still save in both modes, and badges are only earned by clearing a world's levels.
