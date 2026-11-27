import path from "node:path";

/**
 * Splits what the user typed into the project's name and the folder to create it in:
 * "my-game" → my-game in ./my-game; "games/my-game" → my-game in ./games/my-game;
 * "." → the current folder, named after it.
 */
export function parseNameAndPath(input: string): { name: string; dir: string } {
	const dir = path.resolve(input.replace(/[\\/]+$/, "") || ".");
	return { name: path.basename(dir), dir };
}
