// The game's Roblox packages and the types luau-lsp reads.
//
//   node scripts/packages.ts           Install the Wally packages, when wally.toml or wally.lock
//                                      changed since the last install; instant otherwise.
//   node scripts/packages.ts --types   Once sourcemap.json is written: give newly installed packages
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
const manifestHash = () =>
	createHash("sha256").update(read("wally.toml")).update("\0").update(read("wally.lock")).digest("hex");

if (!process.argv.includes("--types")) {
	if (read(STAMP) !== manifestHash()) {
		for (const folder of FOLDERS) fs.rmSync(folder, { recursive: true, force: true });
		run("wally", ["install"]);
		fs.mkdirSync(CACHE, { recursive: true });
		fs.writeFileSync(STAMP, manifestHash());
		fs.writeFileSync(UNTYPED, "");
	}
} else {
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
