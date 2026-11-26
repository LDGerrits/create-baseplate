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
const TYPING = "typing";
const DEFINITIONS = path.join(CACHE, "globalTypes.d.luau");
const DEFINITIONS_VERSION = path.join(CACHE, "version");

/** Runs a tool that logs every file it touches on stdout: that shows only when it fails. */
const runQuiet = (command: string, args: string[]) => {
	// Its warnings, on stderr, still show.
	const result = spawnSync(command, args, {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "inherit"],
		shell: process.platform === "win32",
		maxBuffer: 64 * 1024 * 1024,
	});
	if (result.error) {
		console.error(`${command}: ${result.error.message}`);
		process.exit(1);
	}
	if (result.status !== 0) {
		console.error(result.stdout.trim());
		process.exit(result.status ?? 1);
	}
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

// One run at a time per game: a check, the edit hook's regeneration and an install can overlap, and
// wally-package-types can't type a folder twice. A run waits for the one before it; a lock whose
// process is gone, killed before it could let go, is taken over.
const LOCK = path.join(CACHE, "packages.lock");
const OWNER = path.join(LOCK, "pid");
const alive = (pid: number) => {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		return (error as NodeJS.ErrnoException).code === "EPERM";
	}
};
fs.mkdirSync(CACHE, { recursive: true });
for (const started = Date.now(); ; ) {
	try {
		fs.mkdirSync(LOCK);
		fs.writeFileSync(OWNER, String(process.pid));
		break;
	} catch {
		const owner = Number(read(OWNER));
		const age = Date.now() - (fs.statSync(LOCK, { throwIfNoEntry: false })?.mtimeMs ?? 0);
		// A lock without its owner's pid yet is being taken right now, unless it's old.
		if ((owner > 0 && !alive(owner)) || (!(owner > 0) && age > 10_000)) {
			fs.rmSync(LOCK, { recursive: true, force: true });
		} else if (Date.now() - started > 5 * 60_000) {
			console.error(`Another install holds ${LOCK} (process ${owner}); if none is running, delete it.`);
			process.exit(1);
		} else await new Promise((resolve) => setTimeout(resolve, 200));
	}
}
const release = () => fs.rmSync(LOCK, { recursive: true, force: true });
process.on("exit", release);
for (const [signal, code] of [
	["SIGINT", 130],
	["SIGTERM", 143],
	["SIGHUP", 129],
] as const) {
	process.on(signal, () => process.exit(code));
}

/**
 * Installs the packages beside the old ones and swaps them in only once Wally succeeds, so a failed
 * install (offline, a registry error) leaves the game with the packages it had.
 */
function install() {
	const staging = path.join(CACHE, "install");
	fs.rmSync(staging, { recursive: true, force: true });
	fs.mkdirSync(staging, { recursive: true });
	for (const file of ["wally.toml", "wally.lock"]) {
		if (fs.existsSync(file)) fs.copyFileSync(file, path.join(staging, file));
	}
	const wally = spawnSync("wally", ["install"], {
		cwd: staging,
		stdio: "inherit",
		shell: process.platform === "win32",
	});
	if (wally.error || wally.status !== 0) {
		fs.rmSync(staging, { recursive: true, force: true });
		console.error(
			`Couldn't install the Wally packages${wally.error ? ` (${wally.error.message})` : ""}: Wally needs the network for packages it hasn't fetched. The packages the game had are kept.`,
		);
		process.exit(1);
	}
	for (const folder of FOLDERS) {
		fs.rmSync(folder, { recursive: true, force: true });
		if (fs.existsSync(path.join(staging, folder))) fs.renameSync(path.join(staging, folder), folder);
	}
	if (fs.existsSync(path.join(staging, "wally.lock"))) fs.copyFileSync(path.join(staging, "wally.lock"), "wally.lock");
	fs.rmSync(staging, { recursive: true, force: true });
}

if (!process.argv.includes("--types")) {
	// Install when the manifest or lock changed, a package folder went missing (deleted by hand), or
	// typing began and never finished: wally-package-types can't type a folder twice, so the packages
	// start over. A fresh install that isn't typed yet is left for the typing step.
	if (
		read(STAMP) !== manifestHash() ||
		neededFolders().some((folder) => !fs.existsSync(folder)) ||
		read(UNTYPED) === TYPING
	) {
		install();
		fs.mkdirSync(CACHE, { recursive: true });
		fs.writeFileSync(STAMP, manifestHash());
		fs.writeFileSync(UNTYPED, "installed");
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
		// Until it finishes, a typing that stops partway leaves folders it can't type again, and the
		// next run installs them anew.
		fs.writeFileSync(UNTYPED, TYPING);
		for (const folder of FOLDERS) {
			if (fs.existsSync(folder)) runQuiet("wally-package-types", ["--sourcemap", "sourcemap.json", `${folder}/`]);
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
		const response = await fetch(url).catch((error: Error) => {
			console.error(
				`Couldn't fetch Roblox's types for luau-lsp ${version} (${error.cause instanceof Error ? error.cause.message : error.message}): it needs the network once per luau-lsp version.`,
			);
			process.exit(1);
		});
		if (!response.ok) {
			console.error(`Couldn't fetch Roblox's types for luau-lsp ${version} (${response.status}): ${url}`);
			process.exit(1);
		}
		fs.mkdirSync(path.dirname(DEFINITIONS), { recursive: true });
		fs.writeFileSync(DEFINITIONS, await response.text());
		fs.writeFileSync(DEFINITIONS_VERSION, version);
	}
}
