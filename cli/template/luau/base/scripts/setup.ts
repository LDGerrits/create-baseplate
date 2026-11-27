import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { restoreLink } from "./restore-link.ts";
import { canonical, mainCheckout } from "./worktree.ts";

const run = (command: string, args: string[]) =>
	spawnSync(command, args, { encoding: "utf8", shell: process.platform === "win32" });

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

// The language server is a plugin in .claude/plugins/luau, which Claude Code installs from a
// marketplace named after the clone's path, so deleting one clone can't break another's. In a git
// worktree, Claude Code reads the main checkout's .claude/settings.local.json, so a worktree
// registers the main checkout's plugin rather than one of its own that would outlive it.
const root = mainCheckout(".") ?? canonical(".");
if (!fs.existsSync(path.join(root, ".claude/plugins/luau"))) {
	console.warn(
		`No language server for Claude Code: ${root} has no .claude/plugins/luau; run \`mise run install\` there.`,
	);
	process.exit(0);
}
const marketplace = `baseplate-${createHash("sha256").update(root).digest("hex").slice(0, 8)}`;
fs.mkdirSync(path.join(root, ".claude/plugins/.claude-plugin"), { recursive: true });
fs.writeFileSync(
	path.join(root, ".claude/plugins/.claude-plugin/marketplace.json"),
	`${JSON.stringify(
		{ name: marketplace, owner: { name: "baseplate" }, plugins: [{ name: "luau", source: "./luau" }] },
		undefined,
		"\t",
	)}\n`,
);

if (process.env.BASEPLATE_NO_CLAUDE_PLUGIN === "1") process.exit(0);
if (run("claude", ["--version"]).status !== 0) process.exit(0);
const claude = (args: string[]) =>
	spawnSync("claude", args, { cwd: root, encoding: "utf8", shell: process.platform === "win32" });
for (const name of staleMarketplaces(root, marketplace)) {
	claude(["plugin", "uninstall", `luau@${name}`, "--scope", "local"]);
	claude(["plugin", "marketplace", "remove", name]);
}
for (const args of [
	["plugin", "marketplace", "add", "./.claude/plugins", "--scope", "local"],
	["plugin", "install", `luau@${marketplace}`, "--scope", "local"],
]) {
	const result = claude(args);
	if (result.status !== 0) {
		console.warn(`Couldn't set up Claude Code's language server (claude ${args.join(" ")}):`);
		console.warn(`${result.stdout}${result.stderr}`.trim());
		process.exit(0);
	}
}

function staleMarketplaces(root: string, current: string): string[] {
	const file = path.join(root, ".claude/settings.local.json");
	if (!fs.existsSync(file)) return [];
	try {
		const settings = JSON.parse(fs.readFileSync(file, "utf8")) as { extraKnownMarketplaces?: Record<string, unknown> };
		return Object.keys(settings.extraKnownMarketplaces ?? {}).filter(
			(name) => name.startsWith("baseplate-") && name !== current,
		);
	} catch {
		return [];
	}
}
