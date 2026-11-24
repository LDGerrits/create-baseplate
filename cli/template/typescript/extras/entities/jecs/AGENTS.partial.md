## Entities

Entities live in a Jecs world (`@rbxts/jecs`): `SpinnerService` adds an entity for each part tagged `Spinner`, and runs `spinnerSystem` each frame on the entities that have `Part` and `Spin` components. Write systems as functions of the world and the time, as `spinner-system.ts` does, so a spec can run them on its own world. Tag parts in Studio; `tests/e2e/spinner.luau` makes its own tagged part and checks it turns. Jecs documents its API in comments in `node_modules/@rbxts/jecs/src/jecs.luau`; its `.d.ts` has none.
