// Guard run before each command and edit, for every agent tool that runs hooks. It turns the rules
// agents most often break here into blocks whose message says what to do instead. `.agents/hooks/run`
// starts it, with the tool's reply format as the argument: claude (also Codex's), cursor, copilot
// or gemini.
import fs from "node:fs";
import path from "node:path";
import { type Format, formatArg, projectRoot } from "./project.ts";

export interface Payload {
	cwd?: string;
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
// place has its own project files, world types and builds under projects/<place>/.
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
		"scripts/game-project.ts writes it from default.project.json and world/: run `mise run check`",
	],
	[
		/^(projects\/[^/]+\/)?sourcemap\.json$/,
		"Rojo writes it from game.project.json for luau-lsp: change the code or world/ and run `mise run generate`",
	],
];

// `.env` and its variants hold keys; `.env.example` only lists their names.
const SECRET_IN_COMMAND = /(^|[\s/'"<=])\.env(\.(?!example\b)[\w.-]+)?(?=$|[\s'"\\;|&)])/;
const isSecretFile = (file: string) => /(^|[/\\])\.env(\.(?!example$)[\w.-]+)?$/.test(file);
const SECRET =
	".env holds secret keys: don't print it. .env.example lists the names it can hold; ask the user which are set.";

function checkCommand(command: string): string | undefined {
	// Quoted text, such as a commit message, isn't flags.
	const bare = command.replace(/"(?:[^"\\]|\\.)*"|'[^']*'/g, '""');
	if (/\bgit\b[^|;&]*\bcommit\b[^|;&]*(\s--no-v[a-z-]*|\s-[A-Za-z]*n[A-Za-z]*)(?=\s|$)/.test(bare)) {
		return "The commit hook runs the check on what you commit; commit without --no-verify, and fix what it reports.";
	}
	if (/core\.hooksPath|HUSKY=0|LINT_STAGED/.test(command)) {
		return "Leave the commit hook on; commit normally and fix what it reports.";
	}
	if (/\b(npm|yarn|bun)\s+(i|install|add|ci|remove|rm|uninstall|update|up)\b/.test(command)) {
		return "The game's Roblox packages are Wally's: add them to wally.toml and run `mise run install`. Its Node tools are pnpm's: `pnpm add -D <package>`.";
	}
	if (/(^|[\s;&|(])(npx|bunx|pnpm dlx|bun x)\s/.test(command)) {
		return "Run tools through the project: `mise x -- <tool>`, which finds both the npm ones and the mise ones.";
	}
	if (/\b(rokit|aftman|foreman)\s+(add|install|init|update)\b/.test(command)) {
		return "This project's tools are mise's: pin a tool in mise.toml, then `mise lock` and `mise install`.";
	}
	const reads =
		/\b(cat|less|more|head|tail|grep|rg|sed|awk|bat|xxd|od|strings|base64|source|node|python3?)\b/.test(command) ||
		/<\s*\S*\.env/.test(command);
	if (reads && SECRET_IN_COMMAND.test(command)) return SECRET;
	return undefined;
}

// Codex reports file edits as an apply_patch command; its file names follow these markers.
export const patched = (patch: string) =>
	[...patch.matchAll(/^\*\*\* (?:Add|Update|Delete) File: (.+)$|^\*\*\* Move to: (.+)$/gm)].map((m) =>
		(m[1] ?? m[2] ?? "").trim(),
	);

// Tools that only read: generated files are fine to read, `.env` isn't. Names across the tools:
// Read, Grep and Glob (Claude Code, Cursor), view (Copilot), read_file (Gemini CLI).
const READS = /read|grep|glob|search|list|^ls$|view|fetch/i;
// The argument that names the file, across the tools' edit and read tools: file_path (Claude Code,
// Gemini CLI), path (Copilot), notebook_path (Claude Code), target_file (Cursor's own tools).
const PATH_KEYS = new Set(["file_path", "path", "notebook_path", "target_file", "filePath"]);

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
		...Object.entries(input)
			.filter(([key, value]) => PATH_KEYS.has(key) && typeof value === "string")
			.map(([, value]) => value as string),
	].filter((file): file is string => file !== undefined && file !== "");
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
	const output = guardOutput(formatArg(process.argv[2]), guardReason(payload, root, start));
	if (output !== undefined) console.log(JSON.stringify(output));
}
