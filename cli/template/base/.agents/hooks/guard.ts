// PreToolUse guard for Claude Code, Codex and Cursor. It turns the rules agents most often break
// here into blocks whose message says what to do instead. Pass "cursor" as the first argument for
// Cursor's reply format.
import fs from "node:fs";
import path from "node:path";
import { projectRoot } from "./project.ts";

interface Payload {
	cwd?: string;
	hook_event_name?: string;
	file_path?: string; // Cursor's beforeReadFile
	tool_name?: string;
	tool_input?: { command?: string; file_path?: string; path?: string; notebook_path?: string };
	command?: string; // Cursor's beforeShellExecution
	workspace_roots?: string[];
}

let payload: Payload = {};
try {
	payload = JSON.parse(fs.readFileSync(0, "utf8")) as Payload;
} catch {}
const cursor = process.argv[2] === "cursor";

const start = payload.cwd ?? payload.workspace_roots?.[0] ?? process.cwd();
const root = projectRoot(start) ?? start;

// Files that only their generator writes, and what to run instead. In a multi-place game each
// place has its own project files, world types and builds under projects/<place>/.
const GENERATED: [RegExp, string][] = [
	[/^(out|include)\//, "the compiler writes it: edit its TypeScript source and run `mise run check`"],
	[/^(projects\/[^/]+\/)?build\//, "builds write it: run `mise run build` or `mise run check`"],
	[/^node_modules\//, "pnpm writes it: `pnpm add <package>`, or a patch with `pnpm patch`"],
	[
		/^(projects\/[^/]+\/)?default\.project\.json$/,
		"Rogen writes it from default.rogen.json: change that, or the file layout, and run `mise run check`",
	],
	[
		/^(projects\/[^/]+\/)?game\.project\.json$/,
		"scripts/game-project.ts writes it from default.project.json and world/: run `mise run check`",
	],
	[
		/^(projects\/[^/]+\/)?src\/world\.d\.ts$/,
		"scripts/world-types.ts writes it from world/: change world/ and run `mise run check`",
	],
];

function checkFile(file: string): string | undefined {
	const relative = path.relative(root, path.resolve(start, file)).split(path.sep).join("/");
	for (const [pattern, fix] of GENERATED) {
		if (pattern.test(relative)) return `${relative} is generated, so edits to it are overwritten; ${fix}.`;
	}
	return undefined;
}

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
		return "This project's packages are pnpm's: `pnpm add <package>` (or `pnpm add -D`), `pnpm install --frozen-lockfile`.";
	}
	if (/(^|[\s;&|(])(npx|bunx|rbxtsc|pnpm dlx|bun x)\s/.test(command)) {
		return "Run tools through the project: `mise run check` compiles with Sloptor; other binaries with `pnpm exec <tool>`.";
	}
	const reads =
		/\b(cat|less|more|head|tail|grep|rg|sed|awk|bat|xxd|od|strings|base64|source|node|python3?)\b/.test(command) ||
		/<\s*\S*\.env/.test(command);
	if (reads && SECRET_IN_COMMAND.test(command)) return SECRET;
	return undefined;
}

// Codex reports file edits as an apply_patch command; its file names follow these markers.
const patched = (patch: string) =>
	[...patch.matchAll(/^\*\*\* (?:Add|Update|Delete) File: (.+)$|^\*\*\* Move to: (.+)$/gm)].map((m) =>
		(m[1] ?? m[2] ?? "").trim(),
	);

// Tools that only read: generated files are fine to read, `.env` isn't.
const READS = /read|grep|glob|search|list|^ls$|view|fetch/i;

const input = payload.tool_input ?? {};
const command = payload.command ?? input.command;
const files = [input.file_path, input.path, input.notebook_path, payload.file_path].filter(
	(file): file is string => file !== undefined,
);
let reason: string | undefined;
if (
	payload.hook_event_name === "beforeReadFile" ||
	(payload.tool_name !== undefined && READS.test(payload.tool_name))
) {
	reason = files.some(isSecretFile) ? SECRET : undefined;
} else if (payload.tool_name === "apply_patch" && command !== undefined) {
	reason = patched(command)
		.map(checkFile)
		.find((r) => r !== undefined);
} else {
	reason =
		files.map(checkFile).find((r) => r !== undefined) ?? (command === undefined ? undefined : checkCommand(command));
}

if (cursor) {
	console.log(
		JSON.stringify(
			reason === undefined
				? { permission: "allow" }
				: { permission: "deny", agent_message: reason, user_message: reason },
		),
	);
} else if (reason !== undefined) {
	console.log(
		JSON.stringify({
			hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason },
		}),
	);
}
