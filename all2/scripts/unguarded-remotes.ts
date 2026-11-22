// Finds server code that takes what clients send without Network/Server/Serve.luau: an
// `OnServerEvent` connection or an `OnServerInvoke` callback set anywhere else. Serve.luau gives
// every such remote a rate limit and checks its arguments; a remote taken directly has neither, and
// lets a client flood the server or send it anything. `scripts/check-sources.ts` runs it.
import path from "node:path";

/** The one folder allowed to take remotes directly: Network/Server, where Serve.luau lives. */
const SERVE_FOLDER = /(^|\/)Network\/Server\//;

/** Removes Luau comments, so a remote named in one isn't counted. */
const withoutComments = (code: string) => code.replace(/--\[(=*)\[[\s\S]*?\]\1\]|--.*$/gm, "");

/** One line per unguarded remote: `<file>:<line>: ...`, from each file's path and code. */
export function unguardedRemotes(files: Map<string, string>): string[] {
	const problems: string[] = [];
	for (const [file, code] of files) {
		if (SERVE_FOLDER.test(file.split(path.sep).join("/"))) continue;
		const lines = withoutComments(code).split("\n");
		lines.forEach((line, index) => {
			const taken = /\.(OnServerEvent|OnServerInvoke)\b/.exec(line)?.[1];
			if (taken === undefined) return;
			problems.push(
				`${file}:${index + 1}: ${taken} outside Network/Server takes what clients send with no rate limit or argument check. Declare the remote in the feature's Shared/<Feature>Network.luau and take it with Serve.event or Serve.request, as ClickerService does.`,
			);
		});
	}
	return problems;
}
