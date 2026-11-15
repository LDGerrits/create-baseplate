// @ts-check
import fs from "node:fs";
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript";
import importX from "eslint-plugin-import-x";
import reactHooks from "eslint-plugin-react-hooks";
import roblox from "eslint-plugin-roblox-ts";
import tseslint from "typescript-eslint";

const features = fs
	.readdirSync("src/features", { withFileTypes: true })
	.filter((entry) => entry.isDirectory())
	.map((entry) => entry.name);

/**
 * Import boundaries. Each zone stops files under `target` importing files under `from`.
 * The layers, lowest first: `core` → `features` → `app`. A layer imports only the layers below it.
 */
const zones = [
	{
		target: "./src/**/shared/**",
		from: ["./src/**/server/**", "./src/**/client/**"],
		message: "Shared code ships to both sides, so it can't import server or client code.",
	},
	{
		target: "./src/**/client/**",
		from: "./src/**/server/**",
		message: "Client code can't import server code: it never reaches the client.",
	},
	{
		target: "./src/**/server/**",
		from: "./src/**/client/**",
		message: "Server code can't import client code.",
	},
	{
		target: ["./src/core/**", "./src/features/**"],
		from: "./src/app/**",
		message: "Only app wires features together; nothing imports app.",
	},
	{
		target: "./src/core/**",
		from: "./src/features/**",
		message: "core sits below features, so it can't import them. Move the shared part into core.",
	},
	...features.map((feature) => ({
		target: `./src/features/${feature}`,
		from: "./src/features",
		except: [`./${feature}`],
		message: `Feature "${feature}" can't import another feature. Move what both need into src/core, or connect them in src/app.`,
	})),
];

export default tseslint.config(
	{ ignores: ["out/", "include/", "node_modules/", "*.config.js", ".agents/"] },
	tseslint.configs.strictTypeChecked,
	tseslint.configs.stylisticTypeChecked,
	roblox.configs.recommended,
	reactHooks.configs.flat["recommended-latest"],
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
			"@typescript-eslint/explicit-module-boundary-types": "off",
			"@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
			"@typescript-eslint/no-non-null-assertion": "error",
			// Flamework lifecycle classes (services, controllers) often have no fields.
			"@typescript-eslint/no-extraneous-class": "off",
			// `os.clock()` and Roblox APIs return numbers; templates are fine.
			"@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
		},
	},
);
