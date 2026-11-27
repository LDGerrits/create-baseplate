// The main variants of a game, both languages: what the docs test and `mise run try -- --matrix`
// create. A new question whose choices change the files a game ships adds its variants here.
export const MAIN_VARIANTS: string[][] = [
	[],
	["--language", "typescript"],
	["--managed", "partial"],
	["--language", "typescript", "--managed", "partial"],
	["--places", "multi"],
	["--language", "typescript", "--places", "multi"],
	["--ui", "react"],
	["--language", "typescript", "--ui", "vide"],
];
