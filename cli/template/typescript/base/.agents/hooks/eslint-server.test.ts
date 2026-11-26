// The server that keeps ESLint loaded for the edit hook, with a stand-in for ESLint. `mise run check` runs these.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { ask, changedFiles, type Linted, serve, snapshot, socketPath } from "./eslint-server.ts";

/** A project folder with a source file, a config and a lockfile, removed after `body`. */
async function inProject(body: (root: string) => Promise<void>) {
	const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "eslint-server-")));
	fs.mkdirSync(path.join(root, "src"));
	fs.writeFileSync(path.join(root, "src/a.ts"), "1");
	fs.writeFileSync(path.join(root, "src/b.ts"), "1");
	fs.writeFileSync(path.join(root, "eslint.config.ts"), "1");
	const socket = socketPath(root);
	try {
		await body(root);
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
		if (process.platform !== "win32") fs.rmSync(socket, { force: true });
	}
}

const problem = (file: string): Linted => ({
	filePath: file,
	messages: [{ line: 1, ruleId: "x/y", message: "no" }],
});

/**
 * Starts a server with a counting linter; `stopped` settles when it exits. A test that makes
 * several requests needs an idle time that outlasts a slow CI runner between them.
 */
function start(root: string, idleMs = 60_000) {
	const calls: string[][] = [];
	const linter = async (files: string[]) => {
		calls.push(files);
		return files.map(problem);
	};
	let listening!: () => void;
	const up = new Promise<void>((resolve) => {
		listening = resolve;
	});
	const stopped = serve({ root, linter, idleMs, onListening: listening });
	return { calls, up, stopped };
}

test("answers requests from one linter, so ESLint loads once", async () => {
	await inProject(async (root) => {
		const server = start(root, 1000);
		await server.up;
		const first = await ask(root, ["src/a.ts"]);
		const second = await ask(root, ["src/b.ts"]);
		assert.deepEqual(first, { results: [problem("src/a.ts")] });
		assert.deepEqual(second, { results: [problem("src/b.ts")] });
		assert.deepEqual(server.calls, [["src/a.ts"], ["src/b.ts"]]);
		await server.stopped;
	});
});

test("an edit to the requested file, even one the lint itself fixed, is no reason to restart", async () => {
	await inProject(async (root) => {
		const server = start(root, 1000);
		await server.up;
		fs.writeFileSync(path.join(root, "src/a.ts"), "22");
		assert.ok("results" in ((await ask(root, ["src/a.ts"])) ?? {}));
		fs.writeFileSync(path.join(root, "src/a.ts"), "333");
		assert.ok("results" in ((await ask(root, ["src/a.ts"])) ?? {}));
		await server.stopped;
	});
});

test("replies stale and stops when anything but the requested files changed", async () => {
	for (const change of ["src/b.ts", "eslint.config.ts", "pnpm-lock.yaml", "src/new.ts"]) {
		await inProject(async (root) => {
			const server = start(root);
			await server.up;
			fs.writeFileSync(path.join(root, change), "changed, and longer");
			assert.deepEqual(await ask(root, ["src/a.ts"]), { stale: true }, change);
			await server.stopped;
			assert.equal(server.calls.length, 0);
			// Nothing answers any more, so the caller lints for itself.
			assert.equal(await ask(root, ["src/a.ts"]), undefined);
		});
	}
});

test("a folder asked for covers the changes in it, not the config", async () => {
	await inProject(async (root) => {
		const server = start(root, 1000);
		await server.up;
		fs.writeFileSync(path.join(root, "src/b.ts"), "changed, and longer");
		assert.ok("results" in ((await ask(root, ["src"])) ?? {}), "a change under src/");
		fs.writeFileSync(path.join(root, "eslint.config.ts"), "changed, and longer");
		assert.deepEqual(await ask(root, ["src"]), { stale: true }, "the config");
		await server.stopped;
	});
});

test("stops after idle, leaving no socket behind", async () => {
	await inProject(async (root) => {
		const server = start(root, 100);
		await server.up;
		await server.stopped;
		assert.equal(await ask(root, ["src/a.ts"]), undefined);
		if (process.platform !== "win32") assert.equal(fs.existsSync(socketPath(root)), false);
	});
});

test("a request with no server answers at once with nothing", async () => {
	await inProject(async (root) => {
		const started = Date.now();
		assert.equal(await ask(root, ["src/a.ts"]), undefined);
		assert.ok(Date.now() - started < 1000);
	});
});

test("takes over the socket a crashed server left behind", { skip: process.platform === "win32" }, async () => {
	await inProject(async (root) => {
		fs.writeFileSync(socketPath(root), "");
		const server = start(root, 200);
		await server.up;
		assert.ok("results" in ((await ask(root, ["src/a.ts"])) ?? {}));
		await server.stopped;
	});
});

test("a linter that throws is reported, and the server carries on", async () => {
	await inProject(async (root) => {
		let first = true;
		let listening!: () => void;
		const up = new Promise<void>((resolve) => {
			listening = resolve;
		});
		const stopped = serve({
			root,
			idleMs: 200,
			onListening: listening,
			linter: async (files) => {
				if (first) {
					first = false;
					throw new Error("boom");
				}
				return files.map(problem);
			},
		});
		await up;
		assert.deepEqual(await ask(root, ["src/a.ts"]), { error: "boom" });
		assert.ok("results" in ((await ask(root, ["src/a.ts"])) ?? {}));
		await stopped;
	});
});

test("a snapshot sees sources, the config and the two scripts it imports, and not build output", async () => {
	await inProject(async (root) => {
		for (const [file, text] of [
			["scripts/sides.ts", "x"],
			["scripts/other.ts", "x"],
			["out/a.luau", "x"],
			["node_modules/p/index.ts", "x"],
			["projects/lobby/src/x.ts", "x"],
			["projects/lobby/world/y.json", "x"],
			["src/image.png", "x"],
		] as const) {
			fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
			fs.writeFileSync(path.join(root, file), text);
		}
		assert.deepEqual(
			[...snapshot(root).keys()].sort(),
			["eslint.config.ts", "projects/lobby/src/x.ts", "scripts/sides.ts", "src/a.ts", "src/b.ts"].sort(),
		);
		const before = snapshot(root);
		fs.writeFileSync(path.join(root, "src/a.ts"), "changed, and longer");
		assert.deepEqual(changedFiles(before, snapshot(root)), ["src/a.ts"]);
	});
});
