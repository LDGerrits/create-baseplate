---
name: write-tests
description: Write or run this game's tests. Use when adding a spec, an end-to-end test or an engine spec, when a test fails, or when choosing between ree and real Studio.
---

# Write tests

Every test runs in one of two engines:

- **ree**, an emulated Roblox engine: `mise run test`, a few seconds, offline. `mise run check` runs it.
- **A real Roblox engine** through jest-roblox: `mise run test:engine`, about twenty seconds, in Studio or Open Cloud.

When the two disagree, the real engine is right. ree lets a call to a member it doesn't emulate return nothing, so `mise run test` fails any run that reaches one and names the member and where the game first used it: prove that behaviour in an engine spec instead.

AGENTS.md says which kind of test fits what you test. How to write each:

## Specs

Jest tests, `<Name>.spec.luau` beside the code (in a feature, game system or platform module), with `describe`, `it`, `expect` and `jest` from `ReplicatedStorage.DevPackages.JestGlobals`. `mise run feature <name>` writes one to start from, `server/<Name>Service.spec.luau`: it requires a fresh copy of the service before each test (`jest.resetModules()`, then `require(script.Parent.<Name>Service)`), so state doesn't carry from one test to the next, and calls its functions.

When a decision depends on the time, take `now: number?` as a parameter, as in `function Service.claim(userId: number, now: number?)`, so a spec passes its own times instead of waiting. Fall back to `os.time()` for anything saved or compared across servers (a daily reward, a cooldown that outlives a session): `os.clock()` counts from each server's own start and means nothing on another. Fall back to `os.clock()` only for durations within one server.

jest-lua follows Jest's API with Luau names: `expect(x).toBe(y)`, `toEqual`, `toBeNil`, `toThrow`, `jest.fn()`. Its docs: https://jsdotlua.github.io/jest-lua/.

## End-to-end tests

A ree harness in `tests/e2e/<feature>.luau`, run with the server and one player's client in one process. `scripts/test.ts` runs every file there. Start from this one, which asks the `shop` feature that `mise run feature shop` writes for its value:

```lua
-- A harness replaces the place's own boot, so start the server's entry script ourselves.
local function bootServer()
	local main = game:GetService("ServerScriptService").app.Main
	local run = assert(loadstring(main.Source, "=" .. main:GetFullName()))
	setfenv(run, setmetatable({ script = main }, { __index = getfenv(0) }))
	task.spawn(run)
end

-- Wait for a condition rather than a fixed time: fixed waits make tests slow and flaky.
local function waitFor<T>(what: string, check: () -> T?, seconds: number?): T
	local deadline = os.clock() + (seconds or 5)
	while os.clock() < deadline do
		local value = check()
		if value then
			return value
		end
		task.wait()
	end
	error(`timed out waiting for {what}`)
end

-- The server creates the remotes as its services load. Remo names each after its namespace.
local function remote(name: string): RemoteEvent
	return waitFor(`the {name} remote`, function()
		for _, descendant in game:GetService("ReplicatedStorage"):GetDescendants() do
			if descendant.Name == name and descendant:IsA("RemoteEvent") then
				return descendant
			end
		end
		return nil
	end)
end

return {
	Server = function()
		bootServer()
	end,

	Client = function()
		local values = {}
		remote("shop.changed").OnClientEvent:Connect(function(value)
			table.insert(values, value)
		end)

		remote("shop.request"):FireServer()
		waitFor("the server's answer", function()
			return #values >= 1
		end)

		assert(values[1] == 0, `expected 0, got {values[1]}`)
		print("@done")
	end,
}
```

- `Server` boots the game's own server script; keep `bootServer` as it is.
- `Client` talks to the server through the game's remotes, the way the real client would, and `assert`s on what comes back. Wait for what you expect with `waitFor`, not a fixed `task.wait`; to check that the server dropped something, wait a moment after the last answer you do expect.
- The test passes when the client prints `@done`. A failed `assert`, or any script error on either side, fails it.
- To test what the player sees, start the client's own UI: the client can't run a script's source in ree, so call `start()` from `src/app/client/Start.luau` (`require(game:GetService("StarterPlayer").StarterPlayerScripts.app.Start).start()`), which `Main.client.luau` runs in the game, and read the instances it mounts from `Players.LocalPlayer.PlayerGui`.

## Engine specs

Name the file `<Name>.engine.spec.luau`; ree skips it. After writing or changing one, run `mise run test:engine` yourself.

jest-roblox uses Roblox Studio when it finds it, and Open Cloud otherwise. From WSL it can't find Studio: set `JEST_ROBLOX_STUDIO_PATH` and `JEST_ROBLOX_PLUGINS_DIR` in `.env` (see `.env.example`). Open Cloud needs the `ROBLOX_*` values there. `node_modules/@isentinel/jest-roblox/README.md` covers both.

## When a test fails

`mise run test` prints each failing run's output, with the spec and line: each frame of a trace in the game's code is followed by its file, `→ src/features/shop/server/ShopService.spec.luau:22`. Fix the code or the test until it passes, or tell the user why it stays failing. A test that fails only in ree while it passes in `mise run test:engine` is an emulation gap: make it an engine spec and tell the user.
