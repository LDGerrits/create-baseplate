## State

Client state lives in Charm signals (`@rbxts/charm`). A controller owns its signals and exposes the getter; UI reads one with `useSignalState(getter)` from `@rbxts/vide-charm`, which gives a Vide source that follows the signal. Derive values with `computed`, and react to changes outside UI with `effect` or `subscribe`. Charm's full API is its README, `node_modules/@rbxts/charm/README.md`.
