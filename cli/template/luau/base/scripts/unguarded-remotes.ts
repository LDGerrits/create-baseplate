// Finds code that takes what clients send unguarded. A remote declared with Remo runs its validators
// on what a client sends, and its throttle middleware drops floods; a remote taken directly has
// neither, and lets a client flood the server or send it anything. So it fails on:
// - any use of `OnServerEvent` or `OnServerInvoke` in the game's own code;
// - a Remo remote that clients send (`Remo.ClientToServer` or `Remo.ServerAsync` in the `Remotes`
//   type) declared without `throttleMiddleware`, or without validators when it takes arguments,
//   unless the line above it says `-- trusts-client: <why>`;
// - a `Remo.createRemotes` with no such type, which leaves no way to tell what clients send.
// `scripts/check-sources.ts` runs it.

/**
 * Blanks out Luau's comments, keeping line breaks, so a remote named in one isn't counted, and `--`
 * inside a string doesn't hide the code after it.
 */
const codeOnly = (code: string) =>
	code.replace(
		/--\[(=*)\[[\s\S]*?\]\1\]|--[^\n]*|\[(=*)\[[\s\S]*?\]\2\]|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g,
		(match) => {
			const blank = match.replace(/[^\n]/g, " ");
			// A string stays a string, so `remote["OnServerEvent"]` still reads as one.
			return /^["'`]/.test(match) ? match : blank;
		},
	);

/** One line per unguarded remote: `<file>:<line>: ...`, from each file's path and code. */
export function unguardedRemotes(files: Map<string, string>): string[] {
	const problems: string[] = [];
	for (const [file, code] of files) {
		const lines = codeOnly(code).split("\n");
		lines.forEach((line, index) => {
			// Any use of the name, however it's reached: `.OnServerEvent`, `["OnServerEvent"]`, across lines.
			const taken = /\bOnServer(Event|Invoke)\b/.exec(line)?.[0];
			if (taken === undefined) return;
			problems.push(
				`${file}:${index + 1}: ${taken} takes what clients send with no validators or throttle. Declare the remote with Remo in the feature's shared/<Feature>Network.luau, with a \`t\` validator for each argument and throttleMiddleware, and connect to it, as the service that \`mise run feature\` writes does.`,
			);
		});
	}
	return [...problems, ...unthrottledRemotes(files)];
}

const TRUSTS = /--\s*trusts-client:\s*\S/;

/** The text from `open` (an opening bracket) to its closing one, inclusive; to the end if unclosed. */
function balanced(code: string, open: number): string {
	const pairs: Record<string, string> = { "(": ")", "<": ">", "{": "}" };
	const close = pairs[code[open] ?? ""];
	let depth = 0;
	for (let at = open; at < code.length; at++) {
		if (code[at] === code[open]) depth++;
		else if (code[at] === close && --depth === 0) return code.slice(open, at + 1);
	}
	return code.slice(open);
}

/** The remote's declaration from `start`: up to the comma or brace that ends its entry. */
function declaration(code: string, start: number): string {
	let depth = 0;
	for (let at = start; at < code.length; at++) {
		const char = code[at];
		if (char === "(" || char === "{") depth++;
		else if (char === ")" || char === "}") {
			if (depth === 0) return code.slice(start, at);
			depth--;
		} else if (char === "," && depth === 0) return code.slice(start, at);
	}
	return code.slice(start);
}

/** Remo remotes that clients send, declared without a throttle or without validators. */
function unthrottledRemotes(files: Map<string, string>): string[] {
	const problems: string[] = [];
	for (const [file, original] of files) {
		const code = codeOnly(original);
		const create = /\bRemo\.createRemotes\s*\(/.exec(code);
		if (create === null) continue;
		const lineOf = (at: number) => code.slice(0, at).split("\n").length;
		// Each remote a client sends, and what it sends: the first type argument.
		const sent = new Map<string, string>();
		for (const match of code.matchAll(/\b(\w+)\s*:\s*Remo\.(ClientToServer|ServerAsync)\s*</g)) {
			const args = balanced(code, (match.index ?? 0) + match[0].length - 1).slice(1, -1);
			sent.set(match[1] ?? "", (args.startsWith("(") ? balanced(args, 0) : (args.split(",")[0] ?? "")).trim());
		}
		if (sent.size === 0 && !/\bRemo\.ServerToClient\s*</.test(code)) {
			problems.push(
				`${file}:${lineOf(create.index)}: Remo.createRemotes has no Remotes type, so the check can't tell which remotes clients send. Type it (\`local remotes: Remotes = Remo.createRemotes(...)\`) with Remo.ClientToServer, Remo.ServerToClient and Remo.ServerAsync, as the network \`mise run feature\` writes does.`,
			);
			continue;
		}
		const lines = original.split("\n");
		for (const [name, args] of sent) {
			for (const match of code
				.slice(create.index)
				.matchAll(new RegExp(`\\b${name}\\s*=\\s*Remo\\.remote\\s*\\(`, "g"))) {
				const at = create.index + (match.index ?? 0);
				const line = lineOf(at);
				if (TRUSTS.test(lines[line - 2] ?? "") || TRUSTS.test(lines[line - 1] ?? "")) continue;
				const text = declaration(code, at + match[0].indexOf("Remo.remote"));
				const validators = balanced(text, text.indexOf("(")).slice(1, -1).trim();
				const takesArguments = args !== "" && args.replace(/\s/g, "") !== "()";
				if (!/\bthrottleMiddleware\b/.test(text)) {
					problems.push(
						`${file}:${line}: the remote "${name}" takes what clients send with no throttle, so a client can send it as often as it likes. Add \`.middleware(Remo.throttleMiddleware(<seconds>))\` at a rate that fits the action, or, if any client may send it freely, put \`-- trusts-client: <why>\` on the line above.`,
					);
				}
				if (takesArguments && validators === "") {
					problems.push(
						`${file}:${line}: the remote "${name}" takes ${args} from clients with no validators, so a client can send it anything. Give Remo.remote a \`t\` validator for each argument, such as \`Remo.remote(t.integer)\`.`,
					);
				}
			}
		}
	}
	return problems;
}
