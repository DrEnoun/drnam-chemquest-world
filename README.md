# DR NAM’s CHEMQUEST

**Chemistry with Dr. NAM** · a pixel-art chemistry game for phones.

Travel across a map of six islands. Each world teaches one chemistry topic with a different style of game. Clear a world to earn its badge and open the next. Played in a phone browser, with no login and no app to install.

| # | World | Game | Topic | Status |
|---|---|---|---|---|
| 1 | Lab Meadow | Memory match | Names, formulae and shapes | **Playable** (4 levels) |
| 2 | Orbital Ruins | Push puzzle | Electron configuration | Coming soon |
| 3 | Periodic Falls | Pop and shoot | Periodic table and trends | Coming soon |
| 4 | Trend Peaks | Platform jumper | Periodic trends | Coming soon |
| 5 | Bond Glacier | Drag and drop | Lewis structures and VSEPR | Coming soon |
| 6 | Ion Diner | Diner dash | Ionic compounds and formulae | **Playable** (4 shifts) |

Friendly molecule monsters (H₂O, CO₂, NH₃, CH₄, O₂ and NaCl) roam the map. Tap one to learn its real shape and bonding.

Made for Dr. Nur ’Ainun Mokhtar’s PHD115 Fundamental of Chemistry class at UiTM, and for STEM tours, open days and outreach.

## Play

Open the game link on a phone (Chrome on Android works best). Tap a pin to travel to a world, then tap **Play**.

- **Hearts, coins, XP and stars:** every level has 3 hearts; stars come from the hearts you keep. Progress saves on your device.
- **Wrong answers explain the rule** in the Dr. NAM bubble instead of just saying "wrong".
- **Works offline** after the first visit, so it is safe to use where the wifi is poor. Add it to the home screen to install it.

## Presenting on a projector or big screen

The game adapts to the screen it is on:

- **Wide screens (16:9, 16:10, 3:2: laptops, projectors, TVs):** the map sits on the left and the world card, avatar, topics and badges beside it. Ion Diner shows the scene on the left and the counter, tray and **Serve** button on the right. The memory cards fill the window. Nothing needs scrolling, and text and buttons grow with the window height so they can be read from the back of a room.
- **Square or upright screens (4:3 projectors, tablets held upright):** one column, scaled up for readability.
- **Phones:** one column, with the Serve button pinned to the bottom of the screen.

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
| `data/worlds.json` | The map: world names, topics, colours, pin positions, badges, tips |

Formulae in Ion Diner are worked out from the ion charges, so they cannot be typed wrongly. In the memory game, formulae are written like `SO4^2-` and shapes come from a fixed list with their bond angles.

After editing, run the checks:

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
- `js/progress.js`: unlocking worlds and earning badges. `js/avatar.js`: the avatar creator.
- Game rules live in the `*-logic.js` and `progress.js` files, with no screen code, so they can be tested in Node.
- Style: the Dr. NAM design system in `brand-kit/` (night and day themes, League Spartan and Questrial, electric-lime accent).

## Credits

Created by Chemistry with Dr. NAM (Dr. Nur ’Ainun Mokhtar, UiTM Cawangan Pulau Pinang). The avatar is a generic student-scientist; Dr. NAM appears only as her official badge.

This game grew out of the [Dr. NAM Virtual Secret Lab](https://github.com/DrEnoun/dr-nam-virtual-secret-lab) project.
