import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const BASE = ".baseplate/agent-files.json";
const check = process.argv.includes("--check");

if (!fs.existsSync(BASE)) process.exit(0);
const pin = (JSON.parse(fs.readFileSync("package.json", "utf8")) as { baseplate?: { version?: string } }).baseplate
	?.version;
const { version } = JSON.parse(fs.readFileSync(BASE, "utf8")) as { version: string };

// Clashes sit beside agent files: in the root and the agent tools' folders, not in an agent's
// worktree under .claude/worktrees, which is a checkout of its own.
const FOLDERS = [
	".",
	".agents",
	".claude",
	".codex",
	".cursor",
	".gemini",
	path.join(".github", "hooks"),
	".devcontainer",
	"scripts",
];
const clashes: string[] = [];
const walk = (folder: string, deep: boolean) => {
	if (!fs.existsSync(folder)) return;
	for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
		const at = path.join(folder, entry.name);
		if (entry.isFile() && entry.name.endsWith(".baseplate-new")) clashes.push(at);
		else if (
			deep &&
			entry.isDirectory() &&
			!fs.existsSync(path.join(at, ".git")) &&
			at !== path.join(".claude", "worktrees")
		)
			walk(at, true);
	}
};
const findClashes = () => {
	clashes.length = 0;
	for (const folder of FOLDERS) walk(folder, folder !== ".");
};
findClashes();

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
		findClashes();
		if (sync.error !== undefined || (sync.status !== 0 && clashes.length === 0)) {
			const fetchable =
				spawnSync("pnpm", ["view", `create-baseplate@${pin}`, "version"], {
					stdio: "ignore",
					shell: process.platform === "win32",
				}).status === 0;
			if (!fetchable)
				console.log(
					`✗ Couldn't run create-baseplate@${pin}: pnpm needs the network the first time it runs a version, and the version must be published on npm.`,
				);
			failed = true;
		}
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
