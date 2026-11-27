import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

interface Request {
	files: string[];
	check?: boolean;
}

export interface Linted {
	filePath: string;
	messages: { line: number; ruleId: string | null; message: string; fatal?: boolean }[];
}

export type Reply = { results: Linted[] } | { stale: true } | { error: string };

export type Linter = (files: string[], check: boolean) => Promise<Linted[]>;

// Fixes that would undo what the agent is in the middle of writing: an import it hasn't used yet
// (no-unused-vars deletes it), a `let` it's about to reassign, an import it will use as a value
// (both rewritten to fit the code as it stands). They're still reported, just not applied.
export const UNFIXED = new Set([
	"@typescript-eslint/no-unused-vars",
	"prefer-const",
	"@typescript-eslint/consistent-type-imports",
]);

export const UNFIXED_BY_CHECK = new Set(
	[...UNFIXED].filter((rule) => rule !== "@typescript-eslint/consistent-type-imports"),
);

export const fixable = (ruleId: string | null, check: boolean) =>
	ruleId === null || !(check ? UNFIXED_BY_CHECK : UNFIXED).has(ruleId);

const IDLE_MS = 10 * 60 * 1000;
const ANSWER_MS = 12_000;
const START_MS = 8_000;

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

export function changedFiles(before: Map<string, string>, after: Map<string, string>): string[] {
	return [...new Set([...before.keys(), ...after.keys()])].filter((file) => before.get(file) !== after.get(file));
}

export interface ServeOptions {
	root: string;
	linter: Linter;
	idleMs?: number;
	onListening?: () => void;
}

export async function serve({ root, linter, idleMs = IDLE_MS, onListening }: ServeOptions): Promise<void> {
	const where = socketPath(root);
	let seen = snapshot(root);
	let idle: NodeJS.Timeout | undefined;
	let busy = false;
	let queue: Promise<unknown> = Promise.resolve();
	// The socket file this server made. A new server can take the path once this one has replied
	// stale or lost its file, and Node's server.close() unlinks the path whoever's socket is there,
	// so a server whose socket was replaced leaves without closing its handle.
	let own: fs.Stats | undefined;
	const ownsSocket = () => {
		if (process.platform === "win32" || own === undefined) return true;
		try {
			const now = fs.statSync(where);
			return now.ino === own.ino && now.dev === own.dev && now.ctimeMs === own.ctimeMs;
		} catch {
			return false;
		}
	};
	let finished = () => {};

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
		if (ownsSocket()) {
			server.close();
		} else {
			server.unref();
			finished();
		}
	};
	for (const signal of ["SIGTERM", "SIGINT", "SIGHUP"] as const) process.once(signal, () => process.exit(0));
	process.once("exit", () => {
		if (process.platform !== "win32" && own !== undefined && ownsSocket()) fs.rmSync(where, { force: true });
	});
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
				const covered = (file: string) => asked.has(file) || request.files.some((one) => file.startsWith(`${one}/`));
				const now = snapshot(root);
				if (changedFiles(seen, now).some((file) => !covered(file))) return { stale: true };
				const results = await linter(request.files, request.check === true);
				seen = snapshot(root);
				return { results };
			} catch (error) {
				return { error: error instanceof Error ? error.message : String(error) };
			}
		};
		busy = true;
		if (idle !== undefined) clearTimeout(idle);
		const hung = setTimeout(() => process.exit(1), ANSWER_MS * 2 + 120_000);
		const answer = await (queue = queue.then(lint, lint));
		clearTimeout(hung);
		busy = false;
		if ("stale" in answer) {
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
				if (process.platform !== "win32") own = fs.statSync(where);
				arm();
				onListening?.();
			});
		};
		listen();
		finished = resolve;
		server.on("close", resolve);
	});
}

export function ask(root: string, files: string[], timeoutMs = ANSWER_MS, check = false): Promise<Reply | undefined> {
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
		connection.on("connect", () => connection.write(`${JSON.stringify({ files, check } satisfies Request)}\n`));
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
	let check = false;
	const eslint = new ESLint({ fix: (message) => fixable(message.ruleId, check), warnIgnored: false });
	const linter: Linter = async (files, forCheck) => {
		check = forCheck;
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
			void eslint.calculateConfigForFile(path.join(root, "package.json")).catch(() => {});
		},
	});
	process.exit(0);
}
