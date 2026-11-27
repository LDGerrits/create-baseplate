import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { languageServerOn } from "./project.ts";

const enable = (dir: string) => {
	const marketplace = `baseplate-${createHash("sha256").update(fs.realpathSync.native(dir)).digest("hex").slice(0, 8)}`;
	fs.mkdirSync(path.join(dir, ".claude"), { recursive: true });
	fs.writeFileSync(
		path.join(dir, ".claude", "settings.local.json"),
		JSON.stringify({ enabledPlugins: { [`roblox-ts@${marketplace}`]: true } }),
	);
};

test("the language server is on where the main checkout enabled it, in its worktrees too", () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "language-server-"));
	try {
		const main = path.join(dir, "game");
		fs.mkdirSync(main);
		const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
		const git = (cwd: string, ...args: string[]) => spawnSync("git", args, { cwd, encoding: "utf8", env });
		git(main, "init", "-q");
		git(main, "-c", "user.email=a@b", "-c", "user.name=a", "commit", "-q", "--allow-empty", "-m", "start");
		assert.equal(languageServerOn(main), false);
		enable(main);
		assert.equal(languageServerOn(main), true);
		const tree = path.join(dir, "tree");
		git(main, "worktree", "add", "-q", tree);
		assert.equal(languageServerOn(tree), true);
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});
