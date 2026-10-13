# Editing the content

Everything below is data: no game code needs to change. Run `npm test` after every edit.

## Add an Ion Diner shift (`data/diner.json`)

1. Add an entry to `levels` with the next `id`: `title`, `subtitle`, `customers` (how many customers), `patience` (seconds), `decoys` (extra ions in the tray), `showCharge` (show the live charge counter), `tip`, and its `orders`, for example `{ "cation": "Cu2+", "anion": "O2-", "fact": "optional Pharmacy link" }`.
2. Ions come from the `ions` list at the top. Add new ions there first; the `id` is the symbol plus the charge (`Cu2+`, `SO42-`).
3. A **boss** shift has no `orders`; give it `"boss": true` and `"mixFrom": [1, 2, 3]` to draw from those shifts.
4. Add the new level number to World 6's `levelIds` in `data/worlds.json` and update its `callout` (for example `5 shifts`). A world's badge is earned when every listed level is cleared.
5. Add the new compounds to the answer key `KEY` in `tools/test-game.mjs`. The test then proves the formulae are right.

## Add memory cards (`data/memory.json`)

A **set** is the cards that belong together: 2 cards (name + formula, or formula + shape) or 3 (the boss: name + formula + shape).

- `group`: cards per set. `pick`: how many sets are dealt each game. `time`: seconds, for a timed level.
- Formulae are written like `SO4^2-`: digits become subscripts, and the part after `^` is the charge.
- Shape cards need a `shape` from `js/shapes.js` (`linear`, `bent`, `trigonal planar`, `trigonal pyramidal`, `tetrahedral`) and its `angle`.
- Sets with the same `uniq` key are never dealt together, so two molecules with the same shape cannot be confused.
- Every set has a `fact`, shown in the Dr. NAM bubble.
- Add new compounds to `NAME_FORMULA` / `FORMULA_SHAPE` in `tools/test-game.mjs`.

## Worlds and the map (`data/worlds.json`)

Each world has a name, game, topic, colour, pin position, badge and a Dr. NAM `tip`. A world becomes playable when it has `"playable": true` and a `levelIds` list. Progress is saved per world and level, for example `6.2` for Ion Diner shift 2.

## Orbital Ruins levels (`data/orbitals.json`)

Each level is one atom. The rules (Aufbau, Hund, Pauli) are in `js/orbital-logic.js`, so a level only describes the atom and the board:

- `element`: `symbol`, `name` and `z` (atomic number).
- `given`: subshells that are already full and shown as "given", for example `["1s", "2s"]` for nitrogen.
- `subshells` and `target`: the subshells the player fills and how many electrons each gets, for example `["2p"]` and `{ "2p": 3 }`. Given electrons plus target electrons must equal `z`.
- `cells`: names each socket letter on the board, for example `"a": { "sub": "2p", "box": 0 }`. A subshell needs one socket per orbital (s has 1, p has 3).
- `grid`: the board, one string per row. `#` wall, `.` floor, `@` player, `$` electron block, `a`-`z` sockets (entered only by pushing an electron in). Rows must be the same length, and the number of `$` must equal the electrons to place.
- `tip`, `goal`, `title`, `subtitle`, and `"boss": true` for the last level.

Run `node tools/solve-orbital.mjs` after editing: it shows a shortest solution or reports that the board cannot be solved. `npm test` also solves every level, replays the solution through the game rules, and checks the final configuration against a hand-written answer key (`FULL` in `tools/test-game.mjs`), so add the new element there.

## Periodic Falls rounds (`data/falls.json`)

Each level is a list of rounds. A round is a sign ("Pop the halogens") and a rule; the game picks the right bubbles and the decoys itself.

- `prompt` and `noun`: the sign, and how Dr. NAM names the group in an explanation ("so it is not a halogen").
- `rule`: `{ "type": "family", "value": "halogen" }`. Types: `family` (`alkali`, `alkaline`, `halogen`, `noble`), `category` (`metal`, `nonmetal`, `metalloid`), `group` (1 to 18), `period` (1 to 6) and `block` (`s`, `p`, `d`). Combine two with `{ "all": [rule, rule] }`, for example the nonmetals in period 3.
- `targets`: how many matching bubbles appear (and must be popped). `total`: all bubbles on screen (14 at most). Half of the wrong bubbles are "near misses" from the same period or the next group.
- `fact`: shown when the round is cleared. `time` (seconds) makes a round timed; only the boss level is timed.
- The elements are in `data/elements.json`. If you add one, `npm test` checks its group, period and block against its electron configuration, and each prompt's matching elements against a hand-written answer (`ANSWER` in `tools/test-game.mjs`), so add the new prompt there.

## Trend Peaks climbs (`data/trends.json`)

`values` holds radius (pm), first ionisation energy (kJ/mol) and electronegativity for each element used; they are only used to put the elements in order and are never shown. Each level is a list of climbs: `{ "prop": "radius" | "ie" | "en", "dir": "asc" | "desc", "kind": "group" | "period" | "mixed", "symbols": [...] }`. The game works out the correct order from `values`, so list the symbols in any order.

- `kind: group` means every element is in one group, `period` one period, `mixed` means each neighbour in the climb order shares a group or a period with the one before it.
- Neighbours must differ by at least 6% so no two ledges are nearly tied. Keep to main-group elements (groups 1, 2, 13 to 17), because the trends are cleaner there.
- `time` (seconds) makes a climb timed; only the boss level is timed.
- `npm test` checks every climb against the element's position in the table (down a group, across a period), not against the numbers, so a wrong value is caught.

## Bond Glacier molecules and levels (`data/bonds.json`)

A molecule has `atoms` (`[symbol, x, y]`, in a flat Lewis layout; 40 to 45 units apart works well), `links` (pairs of atom numbers), the answer `key` (`orders` for each link and `lps` lone pairs for each atom), its VSEPR `shape`, and a `fact`. Lone pairs sit on the four compass spots (up, right, down, left) of an atom that do not point at a bond, so lay atoms out on those directions.

- Level kinds: `lone` (single bonds are drawn, add lone pairs), `bonds` (choose bond orders too), `shape` (name the shape of a finished structure) and `boss` (build, then name the shape; needs `time` on each round).
- Only add a molecule to a `lone`, `bonds` or `boss` level if it has exactly one neutral structure where every atom has an octet (hydrogen a duet). `npm test` solves each molecule by search and fails if there are none or several, and checks that the key matches. Octet exceptions such as BF₃ must be marked `"build": false` and can only be used in `shape` levels.
- Shapes available: linear, bent, trigonal planar, trigonal pyramidal and tetrahedral. The test works the shape out from the key (bonded atoms and lone pairs on the central atom) and compares it with the `shape` you wrote.

## Reaction Volcano quests (`data/reactions.json`)

Players walk round the island, collect reactant molecules and mix them in the cauldron. The number of each molecule they bring is its coefficient, so a quest is just an equation.

- **A quest:** `reactants` and `products` are formulae written plainly (`H2SO4`, `Ca(OH)2`). `coeffs` lists the balanced coefficients, reactants first and then products, in the smallest whole numbers. For example `"reactants": ["CH4", "O2"], "products": ["CO2", "H2O"], "coeffs": [1, 2, 1, 2]`.
- `ask` is what the quest giver says, `hint` is shown when the player presses Hint or answers a question wrongly, and `fact` is shown after a correct answer.
- `decoys` are molecules that are not in the equation (a product can be a decoy too: players learn that products come out of the cauldron, not in). `spare` sets how many extra copies of each reactant lie on the island (1 if left out), so players have to count rather than collect everything.
- **Reaction-type levels** (`"askType": true`): each quest also needs `type`, one of the names in `types`.
- **Limiting-reactant levels** (`"limiting": true`): give `field` instead of decoys, the exact molecules on the island, e.g. `{ "H2": 5, "O2": 2 }`. Players collect them all, and the game works out what reacts and what is left over.
- **The island** is the grid of characters in `island`: `~` water, `s` sand, `g` grass, `@` start, `C` cauldron, `N` quest giver, `V` volcano (a 2 × 2 block), `L` lava, `T` palm or tree, `B` bush, `R` rock. Every row must be the same length and the edge must be water.

The cauldron checks the atoms itself, so a wrong `coeffs` entry is caught by `npm test`, which also compares every equation with a hand-written answer key (add your new equation to `KEY` in `tools/test-game.mjs`) and checks that every molecule can be reached on foot.
