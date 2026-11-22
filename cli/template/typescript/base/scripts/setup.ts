// Sets up this clone: the commit hook, the skills link, and the TypeScript language server for
// Claude Code. `mise run install` runs it; it's safe to rerun.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { restoreLink } from "./restore-link.ts";

const run = (command: string, args: string[]) =>
	spawnSync(command, args, { encoding: "utf8", shell: process.platform === "win32" });

// The commit hook. When this project sits in a subfolder of a bigger repo, that repo's own hooks
// decide, so leave them alone.
const prefix = run("git", ["rev-parse", "--show-prefix"]);
if (prefix.status === 0 && prefix.stdout.trim() === "") {
	run("git", ["config", "core.hooksPath", ".githooks"]);
}

// .claude/skills links to .agents/skills. A Windows clone without symbolic links (git's
// core.symlinks off) checks it out as a text file holding the target; make it a link again.
const restored = restoreLink(".claude/skills");
if (restored !== undefined) {
	// Git would see the link as a change to the file; tell it to leave this path alone.
	run("git", ["update-index", "--skip-worktree", ".claude/skills"]);
	const exclude = run("git", ["rev-parse", "--git-path", "info/exclude"]).stdout.trim();
	const entry = `/${run("git", ["rev-parse", "--show-prefix"]).stdout.trim()}.claude/skills/`;
	if (exclude !== "" && !(fs.existsSync(exclude) && fs.readFileSync(exclude, "utf8").split(/\r?\n/).includes(entry))) {
		fs.mkdirSync(path.dirname(exclude), { recursive: true });
		fs.appendFileSync(exclude, `${entry}\n`);
	}
	console.log(`.claude/skills was a file; made it a ${restored} to .agents/skills.`);
}

// The language server is a plugin in .claude/plugins/roblox-ts, which Claude Code installs from a
// marketplace. Each clone and worktree registers its own, named after its path: with one shared
// name, every clone would load the plugin from whichever clone ran setup last, and break when that
// clone is deleted.
const marketplace = `baseplate-${createHash("sha256").update(process.cwd()).digest("hex").slice(0, 8)}`;
fs.mkdirSync(".claude/plugins/.claude-plugin", { recursive: true });
fs.writeFileSync(
	".claude/plugins/.claude-plugin/marketplace.json",
	`${JSON.stringify(
		{ name: marketplace, owner: { name: "baseplate" }, plugins: [{ name: "roblox-ts", source: "./roblox-ts" }] },
		undefined,
		"\t",
	)}\n`,
);

if (run("claude", ["--version"]).status !== 0) process.exit(0);
for (const args of [
	["plugin", "marketplace", "add", "./.claude/plugins", "--scope", "local"],
	["plugin", "install", `roblox-ts@${marketplace}`, "--scope", "local"],
]) {
	const result = run("claude", args);
	if (result.status !== 0) {
		console.warn(`Couldn't set up Claude Code's language server (claude ${args.join(" ")}):`);
		console.warn(`${result.stdout}${result.stderr}`.trim());
		process.exit(0);
	}
}
