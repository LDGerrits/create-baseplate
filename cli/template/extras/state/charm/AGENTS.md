## State

Client state lives in Charm signals (`@rbxts/charm`). A controller owns its signals and exposes the getter, as `ClickerController.clicks` does; UI reads one with `useSignalState(getter)` from `@rbxts/react-charm`, and re-renders when it changes. Derive values with `computed`, and react to changes outside UI with `effect` or `subscribe`.
