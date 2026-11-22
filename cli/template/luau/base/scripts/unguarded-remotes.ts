// Finds server code that takes what clients send without src/Network/Server/Serve.luau: any use of
// `OnServerEvent` or `OnServerInvoke` anywhere else. Serve.luau gives
// every such remote a rate limit and checks its arguments; a remote taken directly has neither, and
// lets a client flood the server or send it anything. `scripts/check-sources.ts` runs it.
import path from "node:path";

/** The one file allowed to take remotes directly: Serve.luau, in the game's Network/Server. */
const SERVE = /^(projects\/common\/)?src\/Network\/Server\/Serve\.luau$/;

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
		if (SERVE.test(file.split(path.sep).join("/"))) continue;
		const lines = codeOnly(code).split("\n");
		lines.forEach((line, index) => {
			// Any use of the name, however it's reached: `.OnServerEvent`, `["OnServerEvent"]`, across lines.
			const taken = /\bOnServer(Event|Invoke)\b/.exec(line)?.[0];
			if (taken === undefined) return;
			problems.push(
				`${file}:${index + 1}: ${taken} outside src/Network/Server/Serve.luau takes what clients send with no rate limit or argument check. Declare the remote in the feature's Shared/<Feature>Network.luau and take it with Serve.event or Serve.request, as ClickerService does.`,
			);
		});
	}
	return problems;
}
