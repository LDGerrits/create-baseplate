import fs from "node:fs";
import { defineConfig } from "eslint/config";
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript";
import importX from "eslint-plugin-import-x";
import jest from "eslint-plugin-jest";
import reactHooks from "eslint-plugin-react-hooks";
import reactX from "eslint-plugin-react-x";
import roblox from "eslint-plugin-roblox-ts";
import tseslint from "typescript-eslint";
import { layerZones } from "./scripts/layers.ts";
import { sideRestrictions } from "./scripts/sides.ts";

// The source roots: src, or in a multi-place game the shared code's and each place's.
const places = fs.existsSync("projects")
	? fs.readdirSync("projects").filter((place) => place !== "common" && fs.existsSync(`projects/${place}/src`))
	: [];
const roots = places.length > 0 ? ["projects/common/src", ...places.map((place) => `projects/${place}/src`)] : ["src"];

/** Where code runs. Rogen sends `server/` to the server only and `shared/` to both sides. */
const sideZones = [
	{
		target: "./**/shared/**",
		from: ["./**/server/**", "./**/client/**"],
		message: "Shared code ships to both sides, so it can't import server or client code.",
	},
	{
		target: "./**/client/**",
		from: "./**/server/**",
		message: "Client code can't import server code: it never reaches the client.",
	},
	{
		target: "./**/server/**",
		from: "./**/client/**",
		message: "Server code can't import client code.",
	},
];

/** Which layer may import which: app, then features, game and platform; see scripts/layers.ts. */
const zones = [...sideZones, ...layerZones(roots, places)];

export default defineConfig(
	{ ignores: ["**/out/", "**/include/", "**/build/", "node_modules/", "**/*.config.ts", ".agents/", "**/world.d.ts"] },
	tseslint.configs.strictTypeChecked,
	// The plugin types its presets as an open record; `recommended` exists.
	roblox.configs.recommended!,
	reactHooks.configs.flat["recommended-latest"],
	reactX.configs["recommended-type-checked"],
	{
		languageOptions: {
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
		plugins: { "import-x": importX },
		settings: {
			"import-x/resolver-next": [createTypeScriptImportResolver()],
			// React comes from @rbxts/react, a port of React 17.
			"react-x": { importSource: "@rbxts/react", version: "17.0.2" },
		},
		rules: {
			"import-x/no-restricted-paths": ["error", { zones }],
			"import-x/no-cycle": "error",
			"import-x/no-self-import": "error",

			// roblox-ts keeps JavaScript's rule that `0`, `""` and `NaN` are falsy by adding checks to the Luau
			// (`if n ~= 0 and n == n and n`), where Luau itself treats them as truthy. Compare numbers and
			// strings explicitly instead. This rule covers every case roblox-ts/lua-truthiness reports (the
			// two flag the same lines), so that one is off: its message tells agents to turn the rule off.
			"roblox-ts/lua-truthiness": "off",
			"@typescript-eslint/strict-boolean-expressions": [
				"error",
				{ allowString: false, allowNumber: false, allowNullableObject: true, allowNullableBoolean: true },
			],
			"@typescript-eslint/switch-exhaustiveness-check": "error",
			"@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
			// Flamework lifecycle classes (services, controllers) often have no fields.
			"@typescript-eslint/no-extraneous-class": "off",
			// Its fix, useSyncExternalStore, is React 18's; react-lua is React 17, where a component
			// subscribes to a controller by setting its state in an effect.
			"react-x/set-state-in-effect": "off",
			// JavaScript's runtime isn't there: the code runs as Luau in Roblox. Each message names what to use.
			"no-restricted-globals": [
				"error",
				{ name: "console", message: "There's no console in Roblox: use print, warn or error." },
				{ name: "setTimeout", message: "Use task.delay(seconds, fn); it returns a thread for task.cancel." },
				{ name: "setInterval", message: "Use a loop with task.wait(seconds) in task.spawn, or RunService.Heartbeat." },
				{ name: "clearTimeout", message: "Use task.cancel(thread) on what task.delay returned." },
				{ name: "clearInterval", message: "Stop the loop or disconnect the Heartbeat connection." },
				{ name: "JSON", message: "Use HttpService.JSONEncode and HttpService.JSONDecode." },
				{ name: "fetch", message: "Use HttpService.RequestAsync, on the server." },
				{
					name: "Object",
					message:
						'Object is nil at runtime: import ObjectUtils from "@rbxts/object-utils" (the name Object is reserved).',
				},
				{
					name: "RegExp",
					message: "There are no regular expressions: use string.match, string.gsub and Lua patterns.",
				},
				{ name: "Date", message: "Use DateTime.now(), os.time() or os.clock()." },
				{ name: "window", message: "There's no DOM: the code runs in Roblox." },
				{ name: "document", message: "There's no DOM: the code runs in Roblox." },
				{ name: "process", message: "There's no Node: the code runs in Roblox." },
				{ name: "require", message: "Import with import; roblox-ts compiles it to a require." },
			],
			// roblox-ts's Promise isn't the built-in one, so without checkThenables the rule sees no promises:
			// an unhandled rejection then only logs, and a fire-and-forget save fails silently.
			"@typescript-eslint/no-floating-promises": ["error", { checkThenables: true }],
			// It flags ordinary generic helpers (a factory whose type parameter appears once) and can't fix them.
			"@typescript-eslint/no-unnecessary-type-parameters": "off",
			// `os.clock()` and Roblox APIs return numbers; templates are fine.
			"@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
		},
	},
	{
		// A network the server only broadcasts on gives Flamework an empty interface for what clients send.
		files: roots.map((root) => `${root}/**/shared/*-network.ts`),
		rules: { "@typescript-eslint/no-empty-object-type": ["error", { allowInterfaces: "always" }] },
	},
	// Roblox APIs that work on one side only, kept out of the other side's folders (scripts/sides.ts).
	...sideRestrictions(roots),
	{
		// Specs: no focused or skipped tests left behind, and every test asserts something.
		files: roots.flatMap((root) => [`${root}/**/*.spec.ts`, `${root}/**/*.spec.tsx`]),
		...jest.configs["flat/recommended"],
		// The specs import Jest's functions from @rbxts/jest-globals, not from globals.
		settings: { jest: { globalPackage: "@rbxts/jest-globals", version: 29 } },
		rules: {
			...jest.configs["flat/recommended"].rules,
			// A skipped test shows in the results; a spec may skip outside the engine on purpose.
			"jest/no-disabled-tests": "off",
			// Assertions through a helper, such as expectBalance(), count.
			"jest/expect-expect": ["error", { assertFunctionNames: ["expect", "expect*"] }],
		},
	},
);
