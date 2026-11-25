// Keeps ESLint loaded between edits. Starting ESLint and TypeScript's program takes about two seconds;
// linting one file in a process that already has them takes a fraction of that. The edit hook
// (edited.ts) asks this server, one per project, to lint the files it edited. The first edit starts it
// and later ones find it; it stops itself after ten idle minutes, or when the project's folder is gone.
//
// Types come from files the server has already read, so it never answers from stale ones: before each
// request it compares the project's sources and configuration with what it saw at the last one, and
// when anything but the requested files changed (a pull, a generated file, a package update, an edit
// made outside the hook), it replies `stale` and exits. The caller then lints in its own process, and
// the next edit starts a fresh server. Every failure of the server, from a refused connection to a
// silence of 12 seconds, makes the caller lint directly; the hook never waits on the server for long.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

/** What a request asks: the files to lint, relative to the project's root. */
interface Request {
	files: string[];
}

/** One file's problems, as ESLint reports them. */
export interface Linted {
	filePath: string;
	messages: { line: number; ruleId: string | null; message: string; fatal?: boolean }[];
}

export type Reply = { results: Linted[] } | { stale: true } | { error: string };

export type Linter = (files: string[]) => Promise<Linted[]>;

// Fixes that would undo what the agent is in the middle of writing: an import it hasn't used yet
// (no-unused-vars deletes it), a `let` it's about to reassign, an import it will use as a value
// (both rewritten to fit the code as it stands). They're still reported, just not applied.
export const UNFIXED = new Set([
	"@typescript-eslint/no-unused-vars",
	"prefer-const",
	"@typescript-eslint/consistent-type-imports",
]);

const IDLE_MS = 10 * 60 * 1000;
/** How long a caller waits for an answer before it lints on its own. */
const ANSWER_MS = 12_000;
/** How long a caller waits for a server it started to be ready. */
const START_MS = 8_000;

/** Where this project's server listens: a socket in the temp folder, or a pipe on Windows. */
export function socketPath(root: string): string {
	const id = createHash("sha256")
		.update(fs.realpathSync(root))
		.update(String(os.userInfo().uid))
		.digest("hex")
		.slice(0, 16);
	return process.platform === "win32"
		? `\\\\.\\pipe\\baseplate-eslint-${id}`
		: path.join(os.tmpdir(), `baseplate-eslint-${id}.sock`);
}

const SKIPPED_FOLDERS = new Set(["node_modules", "out", "build", "include", ".git", "world"]);
const SOURCE = /\.(?:[cm]?[jt]sx?|json5?|jsonc?)$/;

/**
 * What the lint depends on, and when each file was last written: the root's own files (the config,
 * tsconfigs, package.json, the lockfile), the two scripts the config imports, and the TypeScript
 * under src and projects.
 */
export function snapshot(root: string): Map<string, string> {
	const seen = new Map<string, string>();
	const note = (file: string) => {
		try {
			const stat = fs.statSync(path.join(root, file));
			seen.set(file, `${stat.mtimeMs}:${stat.size}`);
		} catch {}
	};
	const walk = (folder: string) => {
		let entries: fs.Dirent[];
		try {
			entries = fs.readdirSync(path.join(root, folder), { withFileTypes: true });
		} catch {
			return;
		}
		for (const entry of entries) {
			const file = folder === "" ? entry.name : `${folder}/${entry.name}`;
			if (entry.isDirectory()) {
				if (!SKIPPED_FOLDERS.has(entry.name) && folder !== "") walk(file);
			} else if (folder === "" || SOURCE.test(entry.name)) note(file);
		}
	};
	walk("");
	walk("src");
	walk("projects");
	note("scripts/layers.ts");
	note("scripts/sides.ts");
	return seen;
}

/** The files that differ between two snapshots: changed, new or gone. */
export function changedFiles(before: Map<string, string>, after: Map<string, string>): string[] {
	return [...new Set([...before.keys(), ...after.keys()])].filter((file) => before.get(file) !== after.get(file));
}

export interface ServeOptions {
	root: string;
	linter: Linter;
	idleMs?: number;
	/** Called once the server is listening. */
	onListening?: () => void;
}

/** Listens for requests until idle. Resolves when the server has stopped. */
export async function serve({ root, linter, idleMs = IDLE_MS, onListening }: ServeOptions): Promise<void> {
	const where = socketPath(root);
	let seen = snapshot(root);
	let idle: NodeJS.Timeout | undefined;
	let busy = false;

	const server = net.createServer((connection) => {
		let text = "";
		connection.setEncoding("utf8");
		connection.on("error", () => {});
		connection.on("data", (chunk: string) => {
			text += chunk;
			if (!text.includes("\n")) return;
			void respond(text, connection);
		});
	});

	const stop = () => {
		if (idle !== undefined) clearTimeout(idle);
		clearInterval(watch);
		if (process.platform !== "win32") fs.rmSync(where, { force: true });
		server.close();
	};
	const arm = () => {
		if (idle !== undefined) clearTimeout(idle);
		idle = setTimeout(stop, idleMs);
	};
	const watch = setInterval(() => {
		if (!busy && !fs.existsSync(root)) stop();
	}, 30_000);
	watch.unref();

	async function respond(text: string, connection: net.Socket) {
		const lint = async (): Promise<Reply> => {
			try {
				const request = JSON.parse(text) as Request;
				const asked = new Set(request.files);
				const now = snapshot(root);
				if (changedFiles(seen, now).some((file) => !asked.has(file))) return { stale: true };
				const results = await linter(request.files);
				seen = snapshot(root);
				return { results };
			} catch (error) {
				return { error: error instanceof Error ? error.message : String(error) };
			}
		};
		busy = true;
		if (idle !== undefined) clearTimeout(idle);
		// A lint that never ends would leave this process behind: stop it.
		const hung = setTimeout(() => process.exit(1), ANSWER_MS * 2);
		const answer = await lint();
		clearTimeout(hung);
		busy = false;
		if ("stale" in answer) {
			// Out of the way before the reply, so the caller's next server can take its place.
			stop();
		} else {
			arm();
		}
		connection.end(`${JSON.stringify(answer)}\n`);
	}

	await new Promise<void>((resolve, reject) => {
		const listen = () => {
			server.once("error", async (error: NodeJS.ErrnoException) => {
				if (error.code !== "EADDRINUSE") return reject(error);
				// Another server is listening, or one died and left its socket behind.
				const alive = await new Promise<boolean>((done) => {
					const probe = net.connect(where);
					probe.on("connect", () => {
						probe.destroy();
						done(true);
					});
					probe.on("error", () => done(false));
				});
				if (alive) return resolve();
				if (process.platform !== "win32") fs.rmSync(where, { force: true });
				listen();
			});
			server.listen(where, () => {
				arm();
				onListening?.();
			});
		};
		listen();
		server.on("close", resolve);
	});
}

/** One request to the server: the reply, or undefined when there's no server or it didn't answer in time. */
export function ask(root: string, files: string[], timeoutMs = ANSWER_MS): Promise<Reply | undefined> {
	return new Promise((resolve) => {
		let text = "";
		let settled = false;
		const finish = (reply: Reply | undefined) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			connection.destroy();
			resolve(reply);
		};
		const connection = net.connect(socketPath(root));
		const timer = setTimeout(() => finish(undefined), timeoutMs);
		connection.setEncoding("utf8");
		connection.on("connect", () => connection.write(`${JSON.stringify({ files } satisfies Request)}\n`));
		connection.on("data", (chunk: string) => {
			text += chunk;
		});
		connection.on("error", () => finish(undefined));
		connection.on("close", () => {
			try {
				finish(JSON.parse(text) as Reply);
			} catch {
				finish(undefined);
			}
		});
	});
}

/** Starts the server for this project in the background, and waits until it answers. */
async function start(root: string): Promise<boolean> {
	const child = spawn(process.execPath, [import.meta.filename, root], {
		cwd: root,
		detached: true,
		stdio: "ignore",
		windowsHide: true,
	});
	child.on("error", () => {});
	child.unref();
	const until = Date.now() + START_MS;
	while (Date.now() < until) {
		const up = await new Promise<boolean>((done) => {
			const probe = net.connect(socketPath(root));
			probe.on("connect", () => {
				probe.destroy();
				done(true);
			});
			probe.on("error", () => done(false));
		});
		if (up) return true;
		await new Promise((wait) => setTimeout(wait, 50));
	}
	return false;
}

/**
 * The lint results for these files from the project's server, starting it when it isn't running, or
 * undefined when the server can't be used and the caller should lint in its own process.
 */
export async function lintViaServer(root: string, files: string[]): Promise<Linted[] | undefined> {
	let reply = await ask(root, files, ANSWER_MS);
	if (reply === undefined || "stale" in reply) {
		if (!(await start(root))) return undefined;
		reply = await ask(root, files, ANSWER_MS);
	}
	return reply !== undefined && "results" in reply ? reply.results : undefined;
}

if (import.meta.main) {
	const root = process.argv[2];
	if (root === undefined) process.exit(1);
	process.chdir(root);
	const { ESLint } = await import("eslint");
	const eslint = new ESLint({
		fix: (message) => message.ruleId === null || !UNFIXED.has(message.ruleId),
		warnIgnored: false,
	});
	const linter: Linter = async (files) => {
		const results = await eslint.lintFiles(files);
		await ESLint.outputFixes(results);
		return results.map(({ filePath, messages }) => ({
			filePath,
			messages: messages.map(({ line, ruleId, message, fatal }) => ({ line, ruleId, message, fatal })),
		}));
	};
	await serve({
		root,
		linter,
		idleMs: Number(process.env.BASEPLATE_ESLINT_IDLE_MS) || IDLE_MS,
		onListening: () => {
			// Load the config and plugins now, while the first request is on its way.
			void eslint.calculateConfigForFile(path.join(root, "package.json")).catch(() => {});
		},
	});
	process.exit(0);
}
