---
name: add-platform-service
description: Wrap one of Roblox's external services (DataStores, purchases, teleports, messaging, HTTP requests, memory stores) in the platform layer. Use when code needs one of them, or ESLint says to reach one through a platform interface.
---

# Add a platform service

`src/platform` is the lowest layer: Roblox's outside world behind interfaces, so a test passes a fake instead of waiting, saving to a real data store or calling the network. `src/platform/clock` is the example; copy its shape.

Wrap only effects that leave the game or depend on time. Instances, datatypes and engine services such as `TweenService` or `CollectionService` stay as they are. `HttpService`'s JSON helpers are fine anywhere; its requests go here.

## Steps

1. Create `src/platform/<area>/` with the side folders it needs: `server/` for server-only services such as DataStores, `shared/` for both sides.
2. Write the interface, `<area>.ts`, in the game's terms rather than Roblox's: `PlayerStore.load(userId)`, not a copy of `GlobalDataStore`. Doc-comment what each method promises, including how it fails.
3. Write the real implementation beside it, the only code that calls the Roblox service. Use method syntax in object literals (`now() { ... }`); roblox-ts rejects an arrow function where the interface declares a method.
4. Write the fake, `fake-<area>.ts`, that a test controls: in-memory data, a switch to make the next call fail, a record of what was sent.
5. Register the real implementation in the `main` file of each side that uses it, before `Flamework.ignite()`: `Modding.registerDependency<PlayerStore>(() => robloxPlayerStore)`.
6. Add the Roblox service's name to `platformServices` in `eslint.config.js`, which bans it outside `src/platform`.
7. Ask for the interface in a service's constructor, `constructor(private readonly store: PlayerStore) {}`, and test the service with the fake (see the `write-tests` skill).
8. Run `mise run check`. If the end-to-end test fails with "Could not find constructor for …", step 5 is missing.
