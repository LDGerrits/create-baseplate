// The game's Roblox packages and the types luau-lsp reads.
//
//   node scripts/packages.ts           Install the Wally packages, when wally.toml or wally.lock
//                                      changed since the last install; instant otherwise.
//   node scripts/packages.ts --types   Once sourcemap.json is written (in a multi-place game, it
//                                      writes the editor's first): give newly installed packages
//                                      their types (wally-package-types), and fetch Roblox's type
//                                      definitions for the pinned luau-lsp into .luau-lsp/.
//
// The mise tasks run both, so every task runs on the locked packages.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const FOLDERS = ["Packages", "ServerPackages", "DevPackages"];
// What this script keeps, beside Roblox's types: outside the package folders, which
// wally-package-types reads whole.
const CACHE = ".luau-lsp";
const STAMP = path.join(CACHE, "packages-installed");
const UNTYPED = path.join(CACHE, "packages-untyped");
const DEFINITIONS = path.join(CACHE, "globalTypes.d.luau");
const DEFINITIONS_VERSION = path.join(CACHE, "version");

const run = (command: string, args: string[]) => {
	const result = spawnSync(command, args, { stdio: "inherit", shell: process.platform === "win32" });
	if (result.error) {
		console.error(`${command}: ${result.error.message}`);
		process.exit(1);
	}
	if (result.status !== 0) process.exit(result.status ?? 1);
};

const read = (file: string) => (fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "");

// jsdotlua/jest 3.10, the last jest-lua release under that name, reports a run's `success` inverted:
// true when a test failed, false when all passed. jest-roblox (`mise run test:engine`) reads it for
// its exit code, so fix that one line in each installed jest-core. Roblox's own roblox/jest (3.20 and
// later, on Wally) has the fix, but needs ScriptService.ResolveModulePath, which ree doesn't emulate
// yet; move to it once ree does, and this goes. A Jest without the line is left alone.
const INVERTED_SUCCESS =
	"aggregatedResults.success = anyTestFailures or aggregatedResults.snapshot.failure or anyReporterErrors";
function fixJestSuccess() {
	const index = path.join("DevPackages", "_Index");
	if (!fs.existsSync(index)) return;
	for (const entry of fs.readdirSync(index)) {
		if (!entry.startsWith("jsdotlua_jest-core@")) continue;
		const file = path.join(index, entry, "jest-core", "src", "TestScheduler.lua");
		const text = read(file);
		if (text.includes(INVERTED_SUCCESS)) {
			fs.writeFileSync(
				file,
				text.replace(
					INVERTED_SUCCESS,
					"aggregatedResults.success = not (anyTestFailures or aggregatedResults.snapshot.failure or anyReporterErrors)",
				),
			);
		}
	}
}
const manifestHash = () =>
	createHash("sha256").update(read("wally.toml")).update("\0").update(read("wally.lock")).digest("hex");

/** The package folders wally.toml fills: one per table with packages in it. */
const neededFolders = () => {
	const tables: Record<string, string> = {
		dependencies: "Packages",
		"server-dependencies": "ServerPackages",
		"dev-dependencies": "DevPackages",
	};
	const needed: string[] = [];
	for (const [, table = "", body = ""] of read("wally.toml").matchAll(
		/^\[([\w-]+)\]\n([\s\S]*?)(?=^\[|(?![\s\S]))/gm,
	)) {
		const folder = tables[table];
		if (folder !== undefined && /^\s*[\w-]+\s*=/m.test(body)) needed.push(folder);
	}
	return needed;
};

if (!process.argv.includes("--types")) {
	// Install when the manifest or lock changed, a package folder went missing (deleted by hand), or
	// typing the last install failed partway: wally-package-types can't type a folder twice, so the
	// packages start over.
	if (
		read(STAMP) !== manifestHash() ||
		neededFolders().some((folder) => !fs.existsSync(folder)) ||
		fs.existsSync(UNTYPED)
	) {
		for (const folder of FOLDERS) fs.rmSync(folder, { recursive: true, force: true });
		run("wally", ["install"]);
		fs.mkdirSync(CACHE, { recursive: true });
		fs.writeFileSync(STAMP, manifestHash());
		fs.writeFileSync(UNTYPED, "");
	}
	fixJestSuccess();
} else {
	// A multi-place game has a sourcemap per place, in projects/<place>/. Editors type one place at a
	// time, from sourcemap.json at the root, which luau-lsp's VS Code extension writes with the
	// generatorCommand in .vscode/settings.json; write it here the same way, once, for the other
	// editors, Claude Code's luau-lsp and wally-package-types.
	if (fs.existsSync("projects")) {
		const settings = JSON.parse(read(path.join(".vscode", "settings.json")) || "{}");
		const command = settings["luau-lsp.sourcemap.generatorCommand"];
		if (typeof command === "string") {
			const [tool = "", ...args] = command.split(/\s+/).filter((arg) => arg !== "--watch");
			const result = spawnSync(tool, args, { encoding: "utf8", shell: process.platform === "win32" });
			if (result.status !== 0) {
				console.error(`${command}: ${result.error?.message ?? `${result.stdout}${result.stderr}`.trim()}`);
				process.exit(1);
			}
		}
	}
	// Wally's package files only point at the package; this copies the package's types into them, so
	// `require(ReplicatedStorage.Packages.React)` is typed. It reads the instance paths from the sourcemap.
	if (fs.existsSync(UNTYPED)) {
		for (const folder of FOLDERS) {
			if (fs.existsSync(folder)) run("wally-package-types", ["--sourcemap", "sourcemap.json", `${folder}/`]);
		}
		fs.rmSync(UNTYPED);
	}
	// Roblox's API as luau-lsp types it, from the luau-lsp release mise pins, for game scripts.
	const version = spawnSync("luau-lsp", ["--version"], {
		encoding: "utf8",
		shell: process.platform === "win32",
	}).stdout?.trim();
	if (!version) {
		console.error("luau-lsp isn't installed: run `mise install`.");
		process.exit(1);
	}
	if (read(DEFINITIONS_VERSION) !== version || !fs.existsSync(DEFINITIONS)) {
		const url = `https://raw.githubusercontent.com/JohnnyMorganz/luau-lsp/${version}/scripts/globalTypes.None.d.luau`;
		const response = await fetch(url);
		if (!response.ok) {
			console.error(`Couldn't fetch Roblox's types for luau-lsp ${version} (${response.status}): ${url}`);
			process.exit(1);
		}
		fs.mkdirSync(path.dirname(DEFINITIONS), { recursive: true });
		fs.writeFileSync(DEFINITIONS, await response.text());
		fs.writeFileSync(DEFINITIONS_VERSION, version);
	}
}
