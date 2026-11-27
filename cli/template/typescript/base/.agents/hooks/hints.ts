export const HINTS: [RegExp, string][] = [
	[
		/non-method where method was expected|expectedMethodGotFunction/,
		"roblox-ts compiles a method and a function property differently: to stub an interface's method, write a method (`{ getBalance() { return 0; } }`), not an arrow function in a property.",
	],
	[
		/Property '\w+' does not exist on type '(Model|Instance|Player|PlayerGui|Folder|Workspace)'/,
		"only instances in the project and world/ are typed. Reach what appears at runtime (a character's Humanoid, a mounted ScreenGui) with WaitForChild or FindFirstChildOfClass and check its class; for a Roblox API member, search node_modules/@rbxts/types/include/generated/None.d.ts.",
	],
	[
		/TS2441: Duplicate identifier 'Object'/,
		'the name Object is reserved: import ObjectUtils from "@rbxts/object-utils".',
	],
	[
		/Cannot find module '(?!\.)[^']*'/,
		"packages come from the @rbxts scope (pnpm add @rbxts/<name>); a plain npm package doesn't run in Roblox. A package from a new scope also needs a mount under ReplicatedStorage.rbxts_include.node_modules in default.rogen.json.",
	],
];

export function hintsFor(output: string): string[] {
	return HINTS.filter(([pattern]) => pattern.test(output)).map(([, hint]) => `Hint: ${hint}`);
}
