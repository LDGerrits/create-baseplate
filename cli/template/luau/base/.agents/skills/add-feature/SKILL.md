---
name: add-feature
description: Add a feature to the game: a service, its remotes, a controller, UI and tests. Use when asked for a new mechanic, system or screen, such as a shop, a quest or a daily reward.
---

# Add a feature

Is it a feature? If the game could ship without it, yes; if other code would break without it (currency, the player's data, the one receipt handler), it's a system: make `game/<system>/` (lowercase letters and digits, like a feature) by hand with `server/`, `client/` and `shared/` as it needs them, and let features import it. `game/` never imports a feature: for many contributors to one owner, have the feature register with a registry in `game/`; for a fact others react to, export a typed signal from the emitter.

Run `mise run feature <name>` with the name in camelCase (`dailyReward`): its modules are `DailyReward…` and its folder `dailyreward/`, since folders are part of a Roblox path. In a multi-place game the feature goes in the shared code and every place lists it; `mise run feature <name> <place>` keeps it to one place. It writes, under `features/<name>/`:

- `shared/<Name>Network.luau`: the remotes between client and server, made with Remo, each with its argument types and, for what clients send, a `t` validator.
- `server/<Name>Service.luau`: the service, which connects to the remotes, and its spec beside it.
- `client/<Name>Controller.luau`: the controller.

and adds the service and the controller to the lists in `app/server/Main.server.luau` and `app/client/Start.luau`, or they never start. Then make it do something:

1. **Rules first.** Put the rules in the service, as functions a spec can call: ownership, cost, cooldowns, limits. The clients ask; nothing the client sends is true until the service checks it. Write the spec for each rule before the code that uses it (`write-tests` skill).
2. **Remotes.** Add them to `shared/<Name>Network.luau`. Give each argument a client sends a `t` validator, and each client-to-server remote a `throttleMiddleware` that fits the action (a purchase is one a second, not twenty).
3. **Controller.** Keep what the UI shows, and let the UI read it from there.
4. **UI.** A component in `client/` with a story, rendered from the root component (`.agents/skills/build-ui/SKILL.md` says how to add one), and look at its picture (`mise run ui -- --filter <name>`): text cut off, overlap, the empty state.
5. **End to end.** A request from the client through the real server and remotes in `tests/e2e/<name>.luau`, started from the harness in the `write-tests` skill.
6. **`mise run check`** until it passes.

## Signals and cleanup

A system announces a change with a typed signal; features subscribe, so the system never requires them:

```luau
local Signal = require(ReplicatedStorage.Packages.Signal)

local CurrencyService = {
	changed = Signal.new() :: Signal.Signal<Player, number>,
}

-- Where the value changes:
CurrencyService.changed:Fire(player, balances[player.UserId])
```

A listener connects in its `start`:

```luau
CurrencyService.changed:Connect(function(player, coins)
	if CoinBadgeService.earn(player.UserId, coins) then
		award(player)
	end
end)
```

What a service starts for one tagged part, player or round goes in a Janitor, destroyed when that thing goes:

```luau
local janitor = Janitor.new()
janitors[coin] = janitor
janitor:Add(
	coin.Touched:Connect(function(hit)
		-- ...
		janitor:Add(task.delay(RESPAWN_SECONDS, setShown, coin, true), true, "respawn")
	end),
	"Disconnect"
)
```

```luau
CollectionService:GetInstanceRemovedSignal(COIN_TAG):Connect(function(coin)
	local janitor = janitors[coin]
	if janitor then
		janitor:Destroy()
		janitors[coin] = nil
	end
end)
```

Where a feature keeps player data or state, follow the section in `AGENTS.md` for the game's data or state library.
