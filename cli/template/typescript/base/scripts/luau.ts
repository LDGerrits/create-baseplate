// Checks the Luau a game keeps beside its TypeScript: a hand-written module roblox-ts copies from
// src/ to out/ untouched, and the end-to-end tests in tests/e2e. The compiled code is not checked.
// Does nothing in a game with no .luau files.
//
//   node scripts/luau.ts stylua [--fix]   Check the formatting, or write it.
//   node scripts/luau.ts selene           Lint.
//   node scripts/luau.ts analyze          Type-check the code in src/ with luau-lsp, strict (.luaurc), new type solver,
//                                         against Roblox's API types, which it fetches for the pinned
//                                         luau-lsp into .luau-lsp/ once.
import fs from "node:fs";
import path from "node:path";
import spawn from "cross-spawn";

/** The folders among `names` (`src`, `tests`), in the root and in each place's folder, that hold a Luau file. */
export function luauFolders(root: string, names: string[]): string[] {
	const places = ["", ...(fs.existsSync(path.join(root, "projects")) ? subfolders(path.join(root, "projects")) : [])];
	const found: string[] = [];
	for (const place of places) {
		for (const name of names) {
			const folder = path.join(place === "" ? "" : path.join("projects", place), name);
			const full = path.join(root, folder);
			if (!fs.existsSync(full) || !fs.statSync(full).isDirectory()) continue;
			const files = fs.readdirSync(full, { recursive: true, encoding: "utf8" });
			if (files.some((file) => /\.luau$/.test(file))) found.push(folder);
		}
	}
	return found;
}

const subfolders = (dir: string) =>
	fs
		.readdirSync(dir, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name);

function exec(command: string, args: string[]) {
	const run = spawn.sync(command, args, { stdio: "inherit" });
	if (run.error) {
		console.error(`${command}: ${run.error.message}`);
		process.exit(1);
	}
	process.exit(run.status ?? 1);
}

async function definitions(version: string) {
	const file = path.join(".luau-lsp", "globalTypes.d.luau");
	const stamp = path.join(".luau-lsp", "version");
	if (fs.existsSync(file) && fs.existsSync(stamp) && fs.readFileSync(stamp, "utf8") === version) return file;
	const url = `https://raw.githubusercontent.com/JohnnyMorganz/luau-lsp/${version}/scripts/globalTypes.None.d.luau`;
	const response = await fetch(url);
	if (!response.ok) {
		console.error(`Couldn't fetch Roblox's types for luau-lsp ${version} (${response.status}): ${url}`);
		process.exit(1);
	}
	fs.mkdirSync(".luau-lsp", { recursive: true });
	fs.writeFileSync(file, await response.text());
	fs.writeFileSync(stamp, version);
	return file;
}

if (import.meta.main) {
	const ROOT = process.cwd();
	const [tool, flag] = process.argv.slice(2);
	if (tool === "stylua" || tool === "selene") {
		const folders = luauFolders(ROOT, ["src", "tests"]);
		if (folders.length === 0) process.exit(0);
		if (tool === "selene") exec("selene", folders);
		exec("stylua", flag === "--fix" ? folders : ["--check", ...folders]);
	} else if (tool === "analyze") {
		const folders = luauFolders(ROOT, ["src"]);
		if (folders.length === 0) process.exit(0);
		const probe = spawn.sync("luau-lsp", ["--version"], { encoding: "utf8" });
		const version = probe.stdout?.trim().replace(/^.*?(\d+\.\d+\.\d+).*$/s, "$1") ?? "";
		if (probe.error || version === "") {
			console.error("luau-lsp isn't installed: run `mise install`.");
			process.exit(1);
		}
		const types = await definitions(version);
		const run = spawn.sync(
			"luau-lsp",
			[
				"analyze",
				"--flag:LuauSolverV2=true",
				"--platform=roblox",
				`--definitions=@roblox=${types}`,
				"--base-luaurc=.luaurc",
				...folders,
			],
			{ encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
		);
		// luau-lsp also logs what it loads; only the problems matter. It exits 0 when it can't read a file.
		const problems = `${run.stdout}${run.stderr}`
			.split(/\r?\n/)
			.filter((line) => line.trim() !== "" && !/^\[(INFO|WARN)\]/.test(line));
		for (const problem of problems) console.log(problem);
		process.exit(problems.length > 0 ? 1 : (run.status ?? 1));
	} else {
		console.error("usage: node scripts/luau.ts stylua [--fix] | selene | analyze");
		process.exit(2);
	}
}
