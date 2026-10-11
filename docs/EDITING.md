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
