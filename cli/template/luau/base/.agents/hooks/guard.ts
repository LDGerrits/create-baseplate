// Guard run before each command and edit, for every agent tool that runs hooks. It turns the rules
// agents most often break here into blocks whose message says what to do instead. `.agents/hooks/run`
// starts it, with the tool's reply format as the argument: claude (also Codex's), cursor, copilot
// or gemini.
import fs from "node:fs";
import path from "node:path";
import { type Format, formatArg, projectRoot } from "./project.ts";
import { isShell, stampShell } from "./written.ts";

export interface Payload {
	cwd?: string;
	session_id?: string; // Claude Code, Codex and Gemini CLI
	hook_event_name?: string;
	tool_name?: string; // Claude Code, Codex, Cursor and Gemini CLI
	tool_input?: Record<string, unknown>;
	toolName?: string; // Copilot
	toolArgs?: unknown; // Copilot: the arguments, as an object or a JSON string
	command?: string; // Cursor's beforeShellExecution
	file_path?: string; // Cursor's beforeReadFile
	workspace_roots?: string[]; // Cursor
}

// Files that only their generator writes, and what to run instead. In a multi-place game each
// place has its own project files, world types and builds under projects/<place>/, and Rogen writes
// its code's project file, <place>.project.json, at the root.
export const GENERATED: [RegExp, string][] = [
	[/^(projects\/[^/]+\/)?build\//, "builds write it: run `mise run build` or `mise run check`"],
	[/^node_modules\//, "pnpm writes it: `pnpm add -D <package>`, for the game's Node tools"],
	[
		/^(Packages|ServerPackages|DevPackages)\//,
		"Wally installs it from wally.toml: add or change the package there and run `mise run install`",
	],
	[/^wally\.lock$/, "Wally writes it: change wally.toml and run `mise run install`"],
	[/^\.luau-lsp\//, "scripts/packages.ts fetches it for the pinned luau-lsp: run `mise run generate`"],
	[
		/^\.baseplate\//,
		"`create-baseplate sync` records in it the agent files as the template wrote them; edit the agent files themselves",
	],
	[
		/^(projects\/[^/]+\/)?default\.project\.json$/,
		"Rogen writes it from default.rogen.json: change that, or the file layout, and run `mise run check`",
	],
	[
		/^((projects\/[^/]+\/)?(game|test)|test\.[^/]+)\.project\.json$/,
		"scripts/game-project.ts writes it from the code's project file and world/ (Rogen writes a place's code as `<place>.project.json`): run `mise run check`",
	],
	[
		/^(projects\/[^/]+\/)?sourcemap\.json$/,
		"Rojo writes it from game.project.json for luau-lsp: change the code or world/ and run `mise run generate`",
	],
	[
		/^[^/]+\.project\.json$/,
		"Rogen writes it from the .rogen.json of the same name, a place's: change that, or the file layout, and run `mise run check`",
	],
];

// `.env` and its variants hold keys; `.env.example` only lists their names.
const SECRET_IN_COMMAND = /(^|[\s/'"<=`(])\.env(\.(?!example\b)[\w.-]+)?(?=$|[\s'"`\\;|&)])/;
// A glob counts too, as Gemini's read_many_files takes: `.env*` or `.env.*` reaches the keys.
const isSecretFile = (file: string) => /(^|[/\\])\.env(\.(?!example$)[\w.*-]+|\*+)?$/.test(file);
const SECRET =
	".env holds secret keys: don't print it. .env.example lists the names it can hold; ask the user which are set.";

// Publishing: the publish script under any runtime, and Rojo's own upload.
const PUBLISH_SCRIPT = /\b(node|bun|deno|tsx)\b[^|;&\n]*publish\.ts\b|\brojo\s+upload\b/;

/**
 * Whether a command publishes: the script, or the task however mise is asked to run it
 * (`mise run -q publish`, `mise r 'publish'`, `mise publish`, a pattern such as `publi*`). Only
 * mise's own arguments count, not those after `--`, which go to the task.
 */
function publishes(command: string): boolean {
	if (PUBLISH_SCRIPT.test(command)) return true;
	for (const [, args = ""] of command.matchAll(/\bmise\b([^|;&\n]*)/g)) {
		const words = (args.split(/\s--(?=\s|$)/)[0] ?? "").split(/\s+/).map((word) => word.replace(/^["']+|["']+$/g, ""));
		const matches = (word: string) =>
			new RegExp(
				`^${word
					.replace(/[.+^${}()|[\]\\]/g, "\\$&")
					.replaceAll("*", ".*")
					.replaceAll("?", ".")}$`,
			).test("publish");
		if (words.some((word) => word === "publish" || (/[*?]/.test(word) && matches(word)))) return true;
	}
	return false;
}

function checkCommand(command: string): string | undefined {
	// Quoted text, such as a commit message, isn't flags.
	const bare = command.replace(/"(?:[^"\\]|\\.)*"|'[^']*'/g, '""');
	if (/\bgit\b[^|;&]*\bcommit\b[^|;&]*(\s--no-v[a-z-]*|\s-[A-Za-z]*n[A-Za-z]*)(?=\s|$)/.test(bare)) {
		return "The commit hook runs the check on what you commit; commit without --no-verify, and fix what it reports.";
	}
	// Quoted text counts here, as in `sh -c "mise run publish"`; only a commit message doesn't.
	const unmessaged = command.replace(/(\s(?:-[A-Za-z]*m\s*|--message(?:=|\s+)))("(?:[^"\\]|\\.)*"|'[^']*')/g, '$1""');
	if (publishes(unmessaged)) {
		return "Publishing replaces the game players join. Only a person publishes, with `mise run publish` or a tag (see `mise run doc publishing`): tell the user it's ready.";
	}
	if (/\b(node|bun|deno|tsx)\b[^|;&\n]*with-env\.ts\b/.test(command)) {
		return "scripts/with-env.ts hands .env's keys to the command after it; only mise's tasks run it. Run the task that needs them (`mise run test:engine`, `ui`, `errors`), or ask the user.";
	}
	// Turning the hooks off: pointing core.hooksPath elsewhere or unsetting it, not reading it.
	if (
		/\bHUSKY=0\b|--unset(-all)?\s+core\.hooksPath\b/.test(unmessaged) ||
		/core\.hooksPath(?:=|\s+)(?!\.githooks(?=["'\s]|$))[^\s-]/.test(unmessaged)
	) {
		return "Leave the commit hook on; commit normally and fix what it reports.";
	}
	if (/\b(npm|yarn|bun)\s+(i|install|add|ci|remove|rm|uninstall|update|up)\b/.test(bare)) {
		return "The game's Roblox packages are Wally's: add them to wally.toml and run `mise run install`. Its Node tools are pnpm's: `pnpm add -D <package>`.";
	}
	if (/(^|[\s;&|(])(npx|bunx|pnpm dlx|bun x)\s/.test(bare)) {
		return "Run tools through the project: `mise x -- <tool>`, which finds both the npm ones and the mise ones.";
	}
	if (/\b(rokit|aftman|foreman)\s+(add|install|init|update)\b/.test(command)) {
		return "This project's tools are mise's: pin a tool in mise.toml, then `mise lock` and `mise install`.";
	}
	// Each command of a plain chain on its own, so `ls .env && cat package.json` passes; a pipe stays
	// whole, as `ls .env | xargs cat` reads it. Quotes, variables, escapes or an inline script
	// (`python3 -c "…"`) can hide what a part reads, so such a command is judged whole.
	const plain = !/["'`$\\]|\b(python3?|node|bun|deno|ruby|perl|sh|bash|zsh|pwsh)(\s+-\w+)*\s+-[ce]\b/.test(command);
	const parts = plain ? command.split(/;|&&|\|\||\n/) : [command];
	if (parts.some((part) => SECRET_IN_COMMAND.test(part) && !leavesSecretUnread(part))) return SECRET;
	return undefined;
}

// Codex reports file edits as an apply_patch command; its file names follow these markers.
export const patched = (patch: string) =>
	[...patch.matchAll(/^\*\*\* (?:Add|Update|Delete) File: (.+)$|^\*\*\* Move to: (.+)$/gm)].map((m) =>
		(m[1] ?? m[2] ?? "").trim(),
	);

/**
 * Whether a command that names .env leaves its keys unread: checking the file is there, or writing
 * to it (`cp .env.example .env`, `echo KEY= >> .env`). Any other command that names it may print it
 * (`cat`, `diff`, `sort`, `jq`, a copy elsewhere), so the guard stops it.
 */
export function leavesSecretUnread(part: string): boolean {
	const command = part.trim();
	// Only a single, simple command: a `$`, a backtick, a chain or a pipe can make it read the file.
	if (!/[$`|;&<()]/.test(command)) {
		// Commands that name the file without reading it.
		if (
			!/['"]/.test(command) &&
			/^(ls|test|\[|stat|touch|rm|git\s+(check-ignore|status|ls-files|rm))(?=\s|$)/.test(command)
		) {
			return true;
		}
		// `git log -- .env` lists commits; with -p it would print what they changed.
		if (/^git\s+log(?=\s)/.test(command) && !/\s(-p|--patch|-u)(?=\s|$)/.test(command)) return true;
		// echo and printf print their arguments, not files: `echo .env >> .gitignore`.
		if (/^(echo|printf)(?=\s)/.test(command)) return true;
		// grep with .env as the pattern, searching other files: `grep -n .env .gitignore`.
		if (/^(grep|rg)(?=\s)/.test(command)) {
			const args = command
				.split(/\s+/)
				.slice(1)
				.filter((arg) => !arg.startsWith("-"))
				.map((arg) => arg.replace(/^['"]|['"]$/g, ""));
			if (args.length >= 2 && !args.slice(1).some((arg) => SECRET_IN_COMMAND.test(arg))) return true;
		}
	}
	// Where it's only the target of a redirect or of a copy or move, nothing reads it.
	const written = command
		.replace(/>>?\s*\S*\.env[\w.-]*/g, "")
		.replace(/^((cp|mv)\b(\s+-\w+)*\s+(\S+\s+)+)\S*\.env[\w.-]*\s*$/, "$1");
	return !SECRET_IN_COMMAND.test(written);
}

// Tools that only read: generated files are fine to read, `.env` isn't. Names across the tools:
// Read, Grep and Glob (Claude Code, Cursor), view (Copilot), read_file (Gemini CLI).
const READS = /read|grep|glob|search|list|^ls$|view|fetch/i;
// The argument that names the file, across the tools' edit and read tools: file_path (Claude Code,
// Gemini CLI), path (Copilot), notebook_path (Claude Code), target_file (Cursor's own tools).
const PATH_KEYS = new Set(["file_path", "path", "paths", "include", "notebook_path", "target_file", "filePath"]);

export function toolInput(payload: Payload): Record<string, unknown> {
	let input = payload.tool_input ?? payload.toolArgs;
	if (typeof input === "string") {
		try {
			input = JSON.parse(input);
		} catch {
			input = { command: input };
		}
	}
	return typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
}

/** The files a tool call names in its arguments, or Cursor in its payload. */
export function namedFiles(payload: Payload, input = toolInput(payload)): string[] {
	return [
		payload.file_path,
		// Gemini's read_many_files takes a list.
		...Object.entries(input)
			.filter(([key]) => PATH_KEYS.has(key))
			.flatMap(([, value]) => (Array.isArray(value) ? value : [value]))
			.filter((value): value is string => typeof value === "string"),
	].filter((file): file is string => file !== undefined && file !== "");
}

// Roblox Studio's MCP server reaches the live game. Each agent tool names its tools its own way
// (mcp__Roblox_Studio__execute_luau, Roblox_Studio-execute_luau, execute_luau): the tool is the end.
const STUDIO_TOOL = /(?:^|[_\-:/.])(open_cloud_invoke|execute_luau)$/;
// Luau that, run in Studio, reads or writes the published game's real data or reaches the internet.
const LIVE_LUAU =
	/DataStoreService|MemoryStoreService|MessagingService|GetSecret|RequestAsync|PostAsync|HttpService\W[\s\S]*GetAsync/;

function checkStudioTool(tool: string, input: Record<string, unknown>): string | undefined {
	if (tool === "open_cloud_invoke") {
		return "Open Cloud acts on the live game: publishing, restarting servers, products, player data. Only a person does that: tell the user what you would run and why.";
	}
	if (LIVE_LUAU.test(JSON.stringify(input))) {
		return "Run in Studio, this Luau reaches the published game's real player data or the internet. Test data code in a spec (`mise run test`), or ask the user to run it.";
	}
	return undefined;
}

/** The reason to block this tool call, or undefined to let it through. */
export function guardReason(payload: Payload, root: string, start: string): string | undefined {
	const checkFile = (file: string): string | undefined => {
		const relative = path.relative(root, path.resolve(start, file)).split(path.sep).join("/");
		for (const [pattern, fix] of GENERATED) {
			if (pattern.test(relative)) return `${relative} is generated, so edits to it are overwritten; ${fix}.`;
		}
		return undefined;
	};
	const toolName = payload.tool_name ?? payload.toolName;
	const input = toolInput(payload);
	const command = payload.command ?? (typeof input.command === "string" ? input.command : undefined);
	const files = namedFiles(payload, input);
	const studioTool = toolName === undefined ? undefined : STUDIO_TOOL.exec(toolName)?.[1];

	if (studioTool !== undefined) return checkStudioTool(studioTool, input);
	// Its `command` is the MCP server's launch command, not something the agent runs.
	if (payload.hook_event_name === "beforeMCPExecution") return undefined;

	if (payload.hook_event_name === "beforeReadFile" || (toolName !== undefined && READS.test(toolName))) {
		return files.some(isSecretFile) ? SECRET : undefined;
	}
	if (toolName === "apply_patch" && command !== undefined) {
		return patched(command)
			.map(checkFile)
			.find((r) => r !== undefined);
	}
	return (
		files.map(checkFile).find((r) => r !== undefined) ?? (command === undefined ? undefined : checkCommand(command))
	);
}

/** What to print for the tool, or undefined to print nothing (no opinion). */
export function guardOutput(format: Format, reason: string | undefined): object | undefined {
	switch (format) {
		case "cursor":
			// Cursor wants an answer either way. "allow" is the weakest vote: any other hook's "ask" or
			// "deny" wins over it, and it doesn't skip Cursor's own approval of commands.
			return reason === undefined
				? { permission: "allow" }
				: { permission: "deny", agent_message: reason, user_message: reason };
		case "copilot":
			return reason === undefined ? undefined : { permissionDecision: "deny", permissionDecisionReason: reason };
		case "gemini":
			return reason === undefined ? undefined : { decision: "deny", reason };
		default:
			return reason === undefined
				? undefined
				: {
						hookSpecificOutput: {
							hookEventName: "PreToolUse",
							permissionDecision: "deny",
							permissionDecisionReason: reason,
						},
					};
	}
}

function readPayload(): Payload {
	try {
		return JSON.parse(fs.readFileSync(0, "utf8")) as Payload;
	} catch {
		return {};
	}
}

if (import.meta.main) {
	const payload = readPayload();
	const start = payload.cwd ?? payload.workspace_roots?.[0] ?? process.cwd();
	const root = projectRoot(start) ?? start;
	const reason = guardReason(payload, root, start);
	// What an allowed shell command writes, the edit hook checks after it (written.ts).
	if (reason === undefined && isShell(payload)) stampShell(root);
	const output = guardOutput(formatArg(process.argv[2]), reason);
	if (output !== undefined) console.log(JSON.stringify(output));
}
