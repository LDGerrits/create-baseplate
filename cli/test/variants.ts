// The main variants of a game, both languages: what the docs test and `mise run try -- --matrix`
// create. A new question whose choices change the files a game ships adds its variants here.
export const MAIN_VARIANTS: string[][] = [
	[],
	["--language", "luau"],
	["--managed", "partial"],
	["--language", "luau", "--managed", "partial"],
	["--places", "multi"],
	["--language", "luau", "--places", "multi"],
	["--ui", "vide"],
	["--language", "luau", "--ui", "vide"],
];
