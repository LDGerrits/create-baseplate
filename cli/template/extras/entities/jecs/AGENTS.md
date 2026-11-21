## Entities

Entities live in a Jecs world (`@rbxts/jecs`): `SpinnerService` adds an entity for each part tagged `Spinner`, and runs `spinnerSystem` each frame on the entities that have `Part` and `Spin` components. Keep systems pure functions of the world and the time, as `spinner-system.ts` does, so a spec can run them on its own world. Tag instances in Studio or in a `.model.json` under `world/`, as `world/Workspace/Spinner.model.json` does; `tests/e2e/spinner.luau` checks the spinner turns.
