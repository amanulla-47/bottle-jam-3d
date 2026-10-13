# Bottle Jam

A full-screen Babylon.js packing puzzle styled after the supplied gameplay reference: a blue packing floor, separate dark conveyors, glossy colored cans, open matching cartons, and a restrained blue HUD.

Run `npm run dev` and open http://localhost:5173. Run `npm run check` for JavaScript syntax validation.

Select a front-row carton to collect four matching cans in a 2 × 2 arrangement. Cans arc into the carton and land gently. Filled cartons fold their flaps, seal with tape, and vanish in place. Keep a waiting slot available; use undo, shuffle, or an extra slot when needed. Seven cans remain visible per lane, with replacements emerging through factory openings. Rounded square cartons form three visible rows and advance independently in each column. Rear cartons stay closed and unfold after arriving at the front. Selecting an open carton makes it jump into an empty waiting slot before packing begins. Early levels begin with two lanes. Progress, coins, and sound preference are stored in the browser.

All meshes and textures are generated locally. Babylon.js is vendored, so the game has no runtime CDN dependency. The recreation uses original meshes and generated levels.
