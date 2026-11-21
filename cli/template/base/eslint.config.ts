import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript";
import importX from "eslint-plugin-import-x";
import jest from "eslint-plugin-jest";
import reactHooks from "eslint-plugin-react-hooks";
import reactX from "eslint-plugin-react-x";
import roblox from "eslint-plugin-roblox-ts";
import tseslint from "typescript-eslint";

/** Where code runs. Rogen sends `server/` to the server only and `shared/` to both sides. */
const zones = [
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

export default tseslint.config(
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

			// roblox-ts has no `null` and treats `0`, `""` and `NaN` as truthy in Luau; be explicit.
			"@typescript-eslint/strict-boolean-expressions": [
				"error",
				{ allowString: false, allowNumber: false, allowNullableObject: true },
			],
			"@typescript-eslint/switch-exhaustiveness-check": "error",
			"@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
			// Flamework lifecycle classes (services, controllers) often have no fields.
			"@typescript-eslint/no-extraneous-class": "off",
			// `os.clock()` and Roblox APIs return numbers; templates are fine.
			"@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
		},
	},
	{
		// Specs: no focused or skipped tests left behind, and every test asserts something.
		files: ["src/**/*.spec.ts", "src/**/*.spec.tsx"],
		...jest.configs["flat/recommended"],
		// The specs import Jest's functions from @rbxts/jest-globals, not from globals.
		settings: { jest: { globalPackage: "@rbxts/jest-globals", version: 29 } },
	},
);
