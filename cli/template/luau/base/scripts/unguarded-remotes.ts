// Finds code that takes what clients send without Remo: any use of `OnServerEvent` or
// `OnServerInvoke` in the game's own code. A remote declared with Remo runs its validators on what
// a client sends, and its throttle middleware drops floods; a remote taken directly has neither,
// and lets a client flood the server or send it anything. `scripts/check-sources.ts` runs it.

/**
 * Blanks out Luau's comments and string contents, keeping line breaks, so a remote named in either
 * isn't counted, and `--` inside a string doesn't hide the code after it.
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
	return problems;
}
