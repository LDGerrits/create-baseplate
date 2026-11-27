## State

Client state lives in Charm signals, from `ReplicatedStorage.Packages.Charm`. `Charm.signal(0)` returns a getter and a setter; a controller keeps the setter to itself and exposes the getter. UI reads one with `useSignalState(getter)` from `ReplicatedStorage.Packages.ReactCharm`, and re-renders when it changes. Derive values with `Charm.computed`, and react to changes outside UI with `Charm.effect` or `Charm.subscribe`. Charm's full API is its README, `Packages/_Index/littensy_charm@*/charm/README.md`.
