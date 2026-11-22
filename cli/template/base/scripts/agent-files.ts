// Keeps the agent files (AGENTS.md, skills, hooks, the agent tools' settings) at the version of
// create-baseplate that package.json's `baseplate.version` pins, which Renovate updates.
// `mise run install` runs it: when the pin moved, `create-baseplate sync` brings the files up to that
// version's template and keeps this game's own edits (see .baseplate/agent-files.json). With
// --check, as the check runs it, it changes nothing and fails while they're behind, or while a
// clash it left (a .baseplate-new file) isn't merged.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const BASE = ".baseplate/agent-files.json";
const check = process.argv.includes("--check");

// The template itself, or a game made before the agent files were recorded, has nothing to keep up.
if (!fs.existsSync(BASE)) process.exit(0);
const pin = (JSON.parse(fs.readFileSync("package.json", "utf8")) as { baseplate?: { version?: string } }).baseplate
	?.version;
const { version } = JSON.parse(fs.readFileSync(BASE, "utf8")) as { version: string };

const clashes: string[] = [];
const walk = (folder: string) => {
	for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
		const at = path.join(folder, entry.name);
		if (entry.isDirectory() && !["node_modules", ".git", "out", "build"].includes(entry.name)) walk(at);
		else if (entry.isFile() && entry.name.endsWith(".baseplate-new")) clashes.push(at);
	}
};
walk(".");

let failed = false;
if (pin !== undefined && pin !== version) {
	if (check || process.env.CI) {
		console.log(
			`✗ package.json pins create-baseplate ${pin}, but the agent files are ${version}'s: run \`mise run install\`.`,
		);
		failed = true;
	} else {
		console.log(`Updating the agent files from create-baseplate ${version} to ${pin}`);
		const sync = spawnSync("pnpm", ["dlx", `create-baseplate@${pin}`, "sync"], {
			stdio: "inherit",
			shell: process.platform === "win32",
		});
		clashes.length = 0;
		walk(".");
		// A clash fails below, from the files it left; any other failure here.
		if (sync.error !== undefined || (sync.status !== 0 && clashes.length === 0)) failed = true;
	}
}
for (const clash of clashes) {
	const file = clash.slice(0, -".baseplate-new".length);
	console.log(
		`✗ ${clash} holds the template's update to ${file}, which clashed with this game's edits: merge what you want of it into ${file}, then delete it.`,
	);
	failed = true;
}
process.exit(failed ? 1 : 0);
