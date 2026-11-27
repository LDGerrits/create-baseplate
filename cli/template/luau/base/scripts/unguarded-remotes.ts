const codeOnly = (code: string) =>
	code.replace(
		/--\[(=*)\[[\s\S]*?\]\1\]|--[^\n]*|\[(=*)\[[\s\S]*?\]\2\]|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g,
		(match) => {
			const blank = match.replace(/[^\n]/g, " ");
			return /^["'`]/.test(match) ? match : blank;
		},
	);

export function unguardedRemotes(files: Map<string, string>): string[] {
	const problems: string[] = [];
	for (const [file, code] of files) {
		const lines = codeOnly(code).split("\n");
		lines.forEach((line, index) => {
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

function balanced(code: string, open: number): string {
	const pairs: Record<string, string> = { "(": ")", "<": ">", "{": "}" };
	const close = pairs[code[open] ?? ""];
	let depth = 0;
	for (let at = open; at < code.length; at++) {
		if (code[at] === ">" && code[at - 1] === "-") continue;
		if (code[at] === code[open]) depth++;
		else if (code[at] === close && --depth === 0) return code.slice(open, at + 1);
	}
	return code.slice(open);
}

function topLevel(list: string): string[] {
	const parts: string[] = [];
	let depth = 0;
	let start = 0;
	for (let at = 0; at < list.length; at++) {
		const char = list[at];
		if ("(<{".includes(char ?? "")) depth++;
		else if (")}".includes(char ?? "") || (char === ">" && list[at - 1] !== "-")) depth--;
		else if (char === "," && depth === 0) {
			parts.push(list.slice(start, at));
			start = at + 1;
		}
	}
	parts.push(list.slice(start));
	return parts.map((part) => part.trim()).filter((part) => part !== "");
}

function declaration(code: string, start: number): string {
	let depth = 0;
	for (let at = start; at < code.length; at++) {
		const char = code[at];
		if (char === "(" || char === "{") depth++;
		else if (char === ")" || char === "}") {
			if (depth === 0) return code.slice(start, at);
			depth--;
		} else if (char === "," && depth === 0) return code.slice(start, at);
		else if (char === "\n" && depth === 0 && !/^\s*[.:]/.test(code.slice(at + 1))) return code.slice(start, at);
	}
	return code.slice(start);
}

function pathAt(code: string, at: number): string[] {
	const keys: string[] = [];
	let depth = 0;
	for (let index = at - 1; index >= 0; index--) {
		if (code[index] === "}") depth++;
		else if (code[index] === "{" && depth-- === 0) {
			depth = 0;
			const before = code.slice(Math.max(0, index - 200), index);
			const key = /(\w+)\s*[:=]\s*(?:Remo\.namespace\s*\(\s*)?$/.exec(before)?.[1];
			if (key === undefined || /\btype\s+\w+\s*=\s*$/.test(before)) break;
			keys.unshift(key);
		}
	}
	return keys;
}

function unthrottledRemotes(files: Map<string, string>): string[] {
	const problems: string[] = [];
	for (const [file, original] of files) {
		const code = codeOnly(original);
		const create = /\bRemo\.createRemotes\s*\(/.exec(code);
		if (create === null) continue;
		const lineOf = (at: number) => code.slice(0, at).split("\n").length;
		const lines = original.split("\n");
		const trusted = (at: number) =>
			TRUSTS.test(lines[lineOf(at) - 2] ?? "") || TRUSTS.test(lines[lineOf(at) - 1] ?? "");

		const KIND = /Remo\.(ClientToServer|ServerAsync)\s*</y;
		const sends = (at: number): string[] => {
			const args = topLevel(balanced(code, code.indexOf("<", at)).slice(1, -1));
			const first = args[0] ?? "";
			return first.startsWith("(") ? topLevel(balanced(first, 0).slice(1, -1)) : args;
		};
		const aliases = new Map<string, string[]>();
		for (const match of code.matchAll(/\btype\s+(\w+)\s*=\s*(?=Remo\.(?:ClientToServer|ServerAsync)\s*<)/g)) {
			aliases.set(match[1] ?? "", sends((match.index ?? 0) + match[0].length));
		}
		const sent = new Map<string, string[]>();
		for (const match of code.matchAll(/\b(\w+)\s*:\s*(\w+(?:\.\w+)?)/g)) {
			const at = (match.index ?? 0) + match[0].length - (match[2] ?? "").length;
			const key = [...pathAt(code, match.index ?? 0), match[1] ?? ""].join(".");
			KIND.lastIndex = at;
			if (KIND.test(code)) sent.set(key, sends(at));
			else if (aliases.has(match[2] ?? "")) sent.set(key, aliases.get(match[2] ?? "") ?? []);
		}
		const typed = sent.size > 0 || /\bRemo\.ServerToClient\s*</.test(code);
		if (!typed) {
			problems.push(
				`${file}:${lineOf(create.index)}: Remo.createRemotes has no Remotes type, so the check can't tell which remotes clients send. Type it (\`local remotes: Remotes = Remo.createRemotes(...)\`) with Remo.ClientToServer, Remo.ServerToClient and Remo.ServerAsync, as the network \`mise run feature\` writes does.`,
			);
			continue;
		}

		const body = balanced(code, create.index + create[0].length - 1);
		const declared = new Map<string, { at: number; text: string }>();
		for (const match of body.matchAll(/\b(\w+)\s*=\s*(?!Remo\.namespace\b)(\S)/g)) {
			const at = create.index + create[0].length - 1 + (match.index ?? 0);
			const value = at + match[0].length - 1;
			const key = [...pathAt(code, at), match[1] ?? ""].join(".");
			const local = /^\w+$/.exec(declaration(code, value).trim())?.[0];
			const named = local === undefined ? undefined : new RegExp(`\\blocal\\s+${local}\\s*=\\s*`).exec(code);
			const start = named === null || named === undefined ? value : (named.index ?? 0) + named[0].length;
			declared.set(key, { at: named ? (named.index ?? 0) : at, text: declaration(code, start) });
		}

		for (const [key, args] of sent) {
			const name = key.split(".").at(-1) ?? key;
			const found = declared.get(key);
			if (found === undefined) {
				problems.push(
					`${file}:${lineOf(create.index)}: can't find where the remote "${key}" that clients send is declared in Remo.createRemotes, so the check can't tell whether it's throttled. Declare it there, \`${name} = Remo.remote(...)\`, as the network \`mise run feature\` writes does.`,
				);
				continue;
			}
			if (trusted(found.at)) continue;
			const line = lineOf(found.at);
			if (!/^Remo\.remote\s*\(/.test(found.text.trim())) {
				problems.push(
					`${file}:${line}: the remote "${key}" that clients send isn't declared with Remo.remote(...), so the check can't tell whether it's throttled. Declare it with Remo.remote, its validators and throttleMiddleware.`,
				);
				continue;
			}
			const text = found.text.trim();
			const validators = topLevel(balanced(text, text.indexOf("(")).slice(1, -1));
			if (!/\bthrottleMiddleware\b/.test(text)) {
				problems.push(
					`${file}:${line}: the remote "${key}" takes what clients send with no throttle, so a client can send it as often as it likes. Add \`.middleware(Remo.throttleMiddleware(<seconds>))\` at a rate that fits the action, or, if any client may send it freely, put \`-- trusts-client: <why>\` on the line above.`,
				);
			}
			if (validators.length < args.length) {
				problems.push(
					`${file}:${line}: the remote "${key}" takes ${args.length} argument${args.length === 1 ? "" : "s"} from clients (${args.join(", ")}) but has ${validators.length} validator${validators.length === 1 ? "" : "s"}, so a client can send it anything. Give Remo.remote a \`t\` validator for each argument, such as \`Remo.remote(t.integer)\`.`,
				);
			}
		}
	}
	return problems;
}
