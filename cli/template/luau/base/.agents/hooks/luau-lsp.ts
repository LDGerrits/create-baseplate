// Starts luau-lsp for Claude Code's Luau plugin (.claude/plugins/luau) and sits between the two.
// Claude Code tells language servers it doesn't watch files and never sends
// workspace/didChangeWatchedFiles, so luau-lsp would keep the sourcemap.json it read at startup,
// and a module or world part added during the session would stay "not found" until the next one.
// This claims the capability, answers luau-lsp's registration for it, and sends the change itself
// when sourcemap.json or .luaurc changes in the folder it runs in.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export interface Message {
	jsonrpc: string;
	id?: number | string;
	method?: string;
	params?: unknown;
	result?: unknown;
	error?: unknown;
}

const WATCHED = ["sourcemap.json", ".luaurc"];

export function frame(message: Message): Buffer {
	const body = Buffer.from(JSON.stringify(message), "utf8");
	return Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, "ascii"), body]);
}

export function readMessages(buffer: Buffer): { messages: Message[]; rest: Buffer } {
	const messages: Message[] = [];
	let rest = buffer;
	for (;;) {
		const end = rest.indexOf("\r\n\r\n");
		if (end === -1) break;
		const length = Number(/content-length:\s*(\d+)/i.exec(rest.subarray(0, end).toString("ascii"))?.[1]);
		if (!Number.isFinite(length)) {
			rest = rest.subarray(end + 4);
			continue;
		}
		if (rest.length < end + 4 + length) break;
		try {
			messages.push(JSON.parse(rest.subarray(end + 4, end + 4 + length).toString("utf8")) as Message);
		} catch {}
		rest = rest.subarray(end + 4 + length);
	}
	return { messages, rest };
}

export function withWatchedFiles(message: Message): Message {
	if (message.method !== "initialize") return message;
	const params = (message.params ?? {}) as { capabilities?: { workspace?: Record<string, unknown> } };
	const capabilities = params.capabilities ?? {};
	const workspace = { ...capabilities.workspace, didChangeWatchedFiles: { dynamicRegistration: true } };
	return { ...message, params: { ...params, capabilities: { ...capabilities, workspace } } };
}

export function isWatchRegistration(message: Message): boolean {
	if (message.method !== "client/registerCapability") return false;
	const registrations = (message.params as { registrations?: { method?: string }[] } | undefined)?.registrations ?? [];
	return registrations.length > 0 && registrations.every((r) => r.method === "workspace/didChangeWatchedFiles");
}

if (import.meta.main) {
	const server = spawn("luau-lsp", process.argv.slice(2), { stdio: ["pipe", "pipe", "inherit"] });
	server.on("error", (error) => {
		console.error(`luau-lsp: ${error.message}`);
		process.exit(1);
	});
	server.on("exit", (code) => process.stdout.end(() => process.exit(code ?? 1)));
	const toServer = (message: Message) => server.stdin.write(frame(message));

	let fromClient: Buffer = Buffer.alloc(0);
	let initialized = false;
	let flush = () => {};
	process.stdin.on("data", (chunk: Buffer) => {
		const { messages, rest } = readMessages(Buffer.concat([fromClient, chunk]));
		fromClient = rest;
		for (const message of messages) {
			toServer(withWatchedFiles(message));
			if (message.method === "initialized") {
				initialized = true;
				flush();
			}
		}
	});
	process.stdin.on("end", () => server.stdin.end());

	let fromServer: Buffer = Buffer.alloc(0);
	server.stdout.on("data", (chunk: Buffer) => {
		const { messages, rest } = readMessages(Buffer.concat([fromServer, chunk]));
		fromServer = rest;
		for (const message of messages) {
			if (isWatchRegistration(message)) toServer({ jsonrpc: "2.0", id: message.id, result: null });
			else process.stdout.write(frame(message));
		}
	});

	// A change comes as several events, and rojo writes sourcemap.json in place: send it once the file
	// has settled into JSON, and only after the client's initialized, as LSP requires.
	const pending = new Set<string>();
	let timer: NodeJS.Timeout | undefined;
	let waits = 0;
	const settled = (file: string) => {
		if (file !== "sourcemap.json" || !fs.existsSync(file)) return true;
		try {
			JSON.parse(fs.readFileSync(file, "utf8"));
			return true;
		} catch {
			return false;
		}
	};
	flush = () => {
		clearTimeout(timer);
		timer = setTimeout(() => {
			if (!initialized || pending.size === 0) return;
			if (![...pending].every(settled) && waits++ < 20) return flush();
			waits = 0;
			const changes = [...pending].map((file) => {
				const at = path.resolve(file);
				return { uri: pathToFileURL(at).href, type: fs.existsSync(at) ? 2 : 3 };
			});
			pending.clear();
			toServer({ jsonrpc: "2.0", method: "workspace/didChangeWatchedFiles", params: { changes } });
		}, 100);
	};
	fs.watch(process.cwd(), (_event, name) => {
		if (name === null || !WATCHED.includes(name.toString())) return;
		pending.add(name.toString());
		flush();
	}).unref();
}
