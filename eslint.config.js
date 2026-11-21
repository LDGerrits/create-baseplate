// @ts-check
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript";
import importX from "eslint-plugin-import-x";
import reactHooks from "eslint-plugin-react-hooks";
import roblox from "eslint-plugin-roblox-ts";
import tseslint from "typescript-eslint";

/** Where code runs. Rogen sends `server/` to the server only and `shared/` to both sides. */
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
];

export default tseslint.config(
	{ ignores: ["out/", "include/", "node_modules/", "*.config.js", ".agents/", "src/world.d.ts"] },
	tseslint.configs.strictTypeChecked,
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
			"@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
			// Flamework lifecycle classes (services, controllers) often have no fields.
			"@typescript-eslint/no-extraneous-class": "off",
			// `os.clock()` and Roblox APIs return numbers; templates are fine.
			"@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
		},
	},
);
