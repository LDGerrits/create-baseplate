import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { envFile, pick } from "./with-env.ts";

const ENV = `# keys
ROBLOX_OPEN_CLOUD_API_KEY=test-key
ROBLOX_PUBLISH_API_KEY="publish key"
ROBLOX_PUBLISH_PLACE_ID=123
RUR_ROBLOX_CONTENT=
`;

test("takes only the named variables, and prefixes ending in *", () => {
	assert.deepEqual(pick(ENV, ["ROBLOX_OPEN_CLOUD_API_KEY"]), { ROBLOX_OPEN_CLOUD_API_KEY: "test-key" });
	assert.deepEqual(pick(ENV, ["ROBLOX_PUBLISH_*"]), {
		ROBLOX_PUBLISH_API_KEY: "publish key",
		ROBLOX_PUBLISH_PLACE_ID: "123",
	});
	assert.deepEqual(pick(ENV, ["RUR_ROBLOX_CONTENT", "MISSING"]), { RUR_ROBLOX_CONTENT: "" });
});

test("the command gets the picked variables and the environment, which wins over .env", () => {
	const script = path.join(import.meta.dirname, "with-env.ts");
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "with-env-"));
	try {
		fs.writeFileSync(path.join(dir, ".env"), ENV);
		const print =
			"console.log(JSON.stringify([process.env.ROBLOX_OPEN_CLOUD_API_KEY, process.env.ROBLOX_PUBLISH_API_KEY, process.env.ROBLOX_PUBLISH_PLACE_ID]))";
		const run = spawnSync(process.execPath, [script, "ROBLOX_PUBLISH_*", "--", process.execPath, "-e", print], {
			encoding: "utf8",
			env: { ...process.env, ROBLOX_PUBLISH_PLACE_ID: "456" },
			cwd: dir,
		});
		assert.equal(run.status, 0, run.stderr);
		assert.deepEqual(JSON.parse(run.stdout), [null, "publish key", "456"]);
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test("a worktree without a .env of its own takes the main checkout's", () => {
	const script = path.join(import.meta.dirname, "with-env.ts");
	const main = fs.mkdtempSync(path.join(os.tmpdir(), "with-env-main-"));
	const worktree = `${main}-worktree`;
	// Without the GIT_* variables a commit hook runs under, which point git at the game's own repo.
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = (cwd: string, ...args: string[]) => {
		const run = spawnSync("git", args, { cwd, encoding: "utf8", env });
		assert.equal(run.status, 0, run.stderr);
	};
	try {
		git(main, "init", "--quiet");
		git(main, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "--quiet", "--allow-empty", "-m", "start");
		git(main, "worktree", "add", "--quiet", worktree);
		fs.writeFileSync(path.join(main, ".env"), ENV);
		const print = "console.log(process.env.ROBLOX_OPEN_CLOUD_API_KEY ?? 'none')";
		const run = (cwd: string) =>
			spawnSync(process.execPath, [script, "ROBLOX_OPEN_CLOUD_API_KEY", "--", process.execPath, "-e", print], {
				encoding: "utf8",
				cwd,
				env,
			}).stdout.trim();
		assert.equal(run(worktree), "test-key");
		fs.writeFileSync(path.join(worktree, ".env"), "ROBLOX_OPEN_CLOUD_API_KEY=own\n");
		assert.equal(run(worktree), "own", "its own .env wins");
	} finally {
		fs.rmSync(worktree, { recursive: true, force: true });
		fs.rmSync(main, { recursive: true, force: true });
	}
});

test("in a bigger repo, the main checkout's .env is the game folder's, and the main checkout has no fallback", () => {
	const repo = fs.mkdtempSync(path.join(os.tmpdir(), "with-env-repo-"));
	const worktree = `${repo}-worktree`;
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = (cwd: string, ...args: string[]) => {
		const run = spawnSync("git", args, { cwd, encoding: "utf8", env });
		assert.equal(run.status, 0, run.stderr);
	};
	try {
		fs.mkdirSync(path.join(repo, "game"));
		fs.writeFileSync(path.join(repo, "game", ".gitkeep"), "");
		git(repo, "init", "--quiet");
		git(repo, "add", ".");
		git(repo, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "--quiet", "-m", "start");
		git(repo, "worktree", "add", "--quiet", worktree);
		fs.writeFileSync(path.join(repo, ".env"), "OUTER=1\n");
		fs.writeFileSync(path.join(repo, "game", ".env"), "GAME=1\n");
		const found = (dir: string) => {
			const file = envFile(dir);
			return file === undefined ? undefined : fs.readFileSync(file, "utf8").trim();
		};
		const saved = { ...process.env };
		for (const key of Object.keys(process.env)) if (key.startsWith("GIT_")) delete process.env[key];
		try {
			assert.equal(found(path.join(worktree, "game")), "GAME=1");
			fs.rmSync(path.join(repo, "game", ".env"));
			assert.equal(found(path.join(repo, "game")), undefined, "not the outer repo's");
		} finally {
			Object.assign(process.env, saved);
		}
	} finally {
		fs.rmSync(worktree, { recursive: true, force: true });
		fs.rmSync(repo, { recursive: true, force: true });
	}
});
