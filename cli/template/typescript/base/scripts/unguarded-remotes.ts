// Finds client-to-server remotes the server takes without a guard. Flamework's types let
// `createServer` leave out any remote's middleware, so a remote can reach a service with no rate
// limit at all, and missing server checks are how games get exploited. Each remote in a network's
// ClientToServer interface needs, where the server creates that network:
// - an entry in `createServer({ middleware: { <remote>: [...] } })`, Flamework middleware that rate-limits it; or
// - `// trusts-client: <why>` on the line above its handler (`.<remote>.connect(` or
//   `.<remote>.setCallback(`), or above or inside the `createServer(` call for the whole network.
// check-sources.ts runs it on the game's sources.
import path from "node:path";

const TRUSTS = /\/\/\s*trusts-client:\s*\S/;

/** Errors for the remotes that `sources` (path from the repo root → text) take unguarded. */
export function unguardedRemotes(sources: Map<string, string>): string[] {
	const errors: string[] = [];
	for (const [file, text] of sources) {
		if (!file.split("/").includes("server")) continue;
		for (const call of text.matchAll(/\b(\w+)\.createServer\s*\(/g)) {
			const network = call[1] ?? "";
			const open = (call.index ?? 0) + call[0].length - 1;
			const config = text.slice(open, closing(text, open) + 1);
			const lineBefore = text.slice(0, call.index).split("\n").at(-2) ?? "";
			if (TRUSTS.test(config) || TRUSTS.test(lineBefore)) continue;

			const definition = findNetwork(sources, file, text, network);
			if (definition === undefined) {
				if (network.endsWith("Network")) {
					errors.push(
						`${file}: can't find where ${network} is created, so the check can't tell which of its remotes need middleware. Import it by name from the shared/<feature>-network.ts that calls Networking.createEvent or Networking.createFunction.`,
					);
				}
				continue;
			}
			const guarded = new Set(middlewareKeys(config));
			for (const remote of clientToServer(definition.text, definition.interfaceName)) {
				if (guarded.has(remote) || trustedHandler(text, remote)) continue;
				errors.push(
					`${file}: ${network}.createServer takes "${remote}" from clients (${definition.file}) with no middleware, so a client can send it as often as it likes. Give it Flamework middleware that rate-limits it, \`middleware: { ${remote}: [...] }\`, and validate the request in the service; or, if any client may send it freely, put \`// trusts-client: <why>\` on the line above its handler.`,
				);
			}
		}
	}
	return errors;
}

/** The index of the bracket that closes the one at `open`, skipping strings and comments. */
function closing(text: string, open: number): number {
	let depth = 0;
	for (let i = open; i < text.length; i++) {
		const char = text[i];
		if (char === '"' || char === "'" || char === "`") {
			for (i++; i < text.length && text[i] !== char; i++) if (text[i] === "\\") i++;
		} else if (char === "/" && text[i + 1] === "/") {
			i = text.indexOf("\n", i) === -1 ? text.length : text.indexOf("\n", i);
		} else if (char === "/" && text[i + 1] === "*") {
			i = text.indexOf("*/", i) === -1 ? text.length : text.indexOf("*/", i) + 1;
		} else if (char === "(" || char === "{" || char === "[") {
			depth++;
		} else if (char === ")" || char === "}" || char === "]") {
			depth--;
			if (depth === 0) return i;
		}
	}
	return text.length - 1;
}

/** `text` without comments and with the inside of every nested bracket emptied: `a(b), { c }` → `a(), {}`. */
function flatten(text: string): string {
	let flat = text.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
	for (let previous = ""; previous !== flat; ) {
		previous = flat;
		flat = flat
			.replace(/\([^()]*\)/g, "()")
			.replace(/\{[^{}]*\}/g, "{}")
			.replace(/\[[^[\]]*\]/g, "[]");
	}
	return flat;
}

/** The keys of the `middleware` object in a `createServer(...)` call's text, except those given an empty `[]` or `{}`. */
function middlewareKeys(config: string): string[] {
	const start = /\bmiddleware\s*:\s*\{/.exec(config);
	if (start === null) return [];
	const open = start.index + start[0].length - 1;
	const raw = config.slice(open + 1, closing(config, open)).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
	const body = flatten(raw.replace(/\[\s*\]|\{\s*\}/g, "EMPTY"));
	return body
		.split(",")
		.filter((entry) => !/:\s*EMPTY\s*$/.test(entry))
		.flatMap((entry) => /^\s*["']?(\w+)/.exec(entry)?.[1] ?? []);
}

/** Where `network` is created, in `file` or a source it imports, with its ClientToServer interface's name. */
function findNetwork(sources: Map<string, string>, file: string, text: string, network: string) {
	const candidates = [{ file, name: network }];
	for (const [, names, specifier] of text.matchAll(
		/^\s*import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["']([^"']+)["']/gm,
	)) {
		if (specifier === undefined || !specifier.startsWith(".")) continue;
		const imported = names
			?.split(",")
			.map((name) => name.trim().split(/\s+as\s+/))
			.find((parts) => parts.at(-1) === network)?.[0];
		if (imported === undefined) continue;
		const base = path.posix.join(path.posix.dirname(file), specifier);
		for (const at of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`])
			candidates.push({ file: at, name: imported });
	}
	for (const candidate of candidates) {
		const definition = sources.get(candidate.file);
		if (definition === undefined) continue;
		const created = new RegExp(
			`\\b${candidate.name}\\s*=\\s*Networking\\.create(?:Event|Function)\\s*<\\s*(\\w+)`,
		).exec(definition);
		if (created?.[1] !== undefined) {
			return { file: candidate.file, text: definition, interfaceName: created[1] };
		}
	}
	return undefined;
}

/** The remotes a ClientToServer interface (or type literal) declares: its members' names. */
function clientToServer(text: string, name: string): string[] {
	const start = new RegExp(`\\b(?:interface\\s+${name}\\b[^{]*|type\\s+${name}\\s*=\\s*)\\{`).exec(text);
	if (start === null) return [];
	const open = start.index + start[0].length - 1;
	const body = flatten(text.slice(open + 1, closing(text, open)));
	return body
		.split(/[;,\n]/)
		.flatMap((member) => /^\s*(?:readonly\s+)?["']?(\w+)["']?\??\s*[(<:]/.exec(member)?.[1] ?? []);
}

/** Whether the line above `remote`'s handler in `text` says `// trusts-client: <why>`. */
function trustedHandler(text: string, remote: string): boolean {
	const lines = text.split("\n");
	const handler = new RegExp(`\\.${remote}\\s*\\.\\s*(?:connect|setCallback)\\s*\\(`);
	return lines.some((line, i) => handler.test(line) && i > 0 && TRUSTS.test(lines[i - 1] ?? ""));
}
