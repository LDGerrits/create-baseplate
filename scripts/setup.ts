// Sets up this clone: the commit hook, and the TypeScript language server for Claude Code.
// `mise run install` runs it; it's safe to rerun.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";

const run = (command: string, args: string[]) =>
	spawnSync(command, args, { encoding: "utf8", shell: process.platform === "win32" });

if (run("git", ["rev-parse", "--git-dir"]).status === 0) {
	run("git", ["config", "core.hooksPath", ".githooks"]);
}

// The language server is a plugin in .claude/plugins/roblox-ts, which Claude Code installs from a
// marketplace. Each clone and worktree registers its own, named after its path: with one shared
// name, every clone would load the plugin from whichever clone ran setup last, and break when that
// clone is deleted.
const marketplace = `agent-baseplate-${createHash("sha256").update(process.cwd()).digest("hex").slice(0, 8)}`;
fs.mkdirSync(".claude/plugins/.claude-plugin", { recursive: true });
fs.writeFileSync(
	".claude/plugins/.claude-plugin/marketplace.json",
	`${JSON.stringify(
		{ name: marketplace, owner: { name: "agent-baseplate" }, plugins: [{ name: "roblox-ts", source: "./roblox-ts" }] },
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
