// Type-checks the game's Luau with luau-lsp: strict (.luaurc), against every instance in the place
// (sourcemap.json, which `mise run generate` writes from game.project.json, world included), with
// Roblox's API types (.luau-lsp/, from scripts/packages.ts), and the editor's luau-lsp settings
// (.vscode/settings.json, which holds no comments: luau-lsp can't read them), so the check and the
// editor agree: types for every instance (`luau-lsp.diagnostics.strictDatamodelTypes`; without it,
// `game`, `script` and `workspace` are untyped). Reports problems in the game's own
// code; the packages' are theirs. Runs in a place's folder, as `mise run check` runs it.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.env.ROOT ?? process.cwd();
const definitions = path.join(ROOT, ".luau-lsp", "globalTypes.d.luau");
if (!fs.existsSync(definitions)) {
	console.error("Roblox's types for luau-lsp are missing: run `mise run generate`.");
	process.exit(1);
}
// The place's code; in a multi-place game, the shared code too, as this place sees it.
const sources = ["src", path.join(ROOT, "projects", "common", "src")].filter((dir) => fs.existsSync(dir));

const run = spawnSync(
	"luau-lsp",
	[
		"analyze",
		"--platform=roblox",
		`--settings=${path.join(ROOT, ".vscode", "settings.json")}`,
		"--sourcemap=sourcemap.json",
		`--definitions=@roblox=${definitions}`,
		`--base-luaurc=${path.join(ROOT, ".luaurc")}`,
		"--ignore=**/Packages/**",
		"--ignore=**/ServerPackages/**",
		"--ignore=**/DevPackages/**",
		"--ignore=**/node_modules/**",
		...sources,
	],
	{ encoding: "utf8", maxBuffer: 64 * 1024 * 1024, shell: process.platform === "win32" },
);
if (run.error) {
	console.error(`luau-lsp: ${run.error.message}`);
	process.exit(1);
}
// Only the problems, each once, with paths from the repo root: luau-lsp also logs what it loads.
const problems = [
	...new Set(
		`${run.stdout}${run.stderr}`
			.split(/\r?\n/)
			.filter((line) => line.trim() !== "" && !/^\[(INFO|WARN)\]/.test(line))
			.map((line) => line.replace(`${path.resolve(ROOT)}${path.sep}`, "")),
	),
];
for (const problem of problems) console.log(problem);
// luau-lsp exits 0 when it can't read its settings; any line left is a problem.
process.exit(problems.length > 0 ? 1 : (run.status ?? 1));
