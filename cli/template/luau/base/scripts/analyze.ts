// Type-checks the game's Luau with luau-lsp: strict (.luaurc), against every instance in the place
// (sourcemap.json, which `mise run generate` writes from game.project.json, world included), with
// Roblox's API types (.luau-lsp/, from scripts/packages.ts), and the editor's luau-lsp settings
// (.vscode/settings.json, which holds no comments: luau-lsp can't read them), so the check and the
// editor agree: types for every instance (`luau-lsp.diagnostics.strictDatamodelTypes`; without it,
// `game`, `script` and `workspace` are untyped). Reports problems in the game's own
// code; the packages' are theirs. Runs in a place's folder, as `mise run check` runs it.
import fs from "node:fs";
import path from "node:path";
// cross-spawn finds luau-lsp on Windows without a shell, which would split paths with spaces.
import spawn from "cross-spawn";

const ROOT = process.env.ROOT ?? process.cwd();
const definitions = path.join(ROOT, ".luau-lsp", "globalTypes.d.luau");
if (!fs.existsSync(definitions)) {
	console.error("Roblox's types for luau-lsp are missing: run `mise run generate`.");
	process.exit(1);
}
// The place's code; in a multi-place game, the shared code too, as this place sees it.
const sources = ["src", path.join(ROOT, "projects", "common", "src")].filter((dir) => fs.existsSync(dir));
// What the place's project file leaves out (its `globIgnorePaths`, such as the shared code's specs in
// the places that don't run them) isn't in its sourcemap, so it's type-checked in another place.
const project = JSON.parse(fs.readFileSync("game.project.json", "utf8")) as { globIgnorePaths?: string[] };
// luau-lsp matches its globs against paths from here, as the project file's are.
const ignored = (project.globIgnorePaths ?? []).map((glob) => `--ignore=${glob}`);

const run = spawn.sync(
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
		...ignored,
		...sources,
	],
	{ encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
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
			// luau-lsp prints a file as it was given, absolute or from here (in a place's folder, src/...).
			.map((line) =>
				line.replace(/^(?![A-Za-z]:|[\\/])\S+?\.luau?(?=[\s(])/, (file) => path.relative(ROOT, path.resolve(file))),
			)
			.map((line) => line.replace(`${path.resolve(ROOT)}${path.sep}`, "")),
	),
];
for (const problem of problems) console.log(problem);
// luau-lsp exits 0 when it can't read its settings; any line left is a problem.
process.exit(problems.length > 0 ? 1 : (run.status ?? 1));
