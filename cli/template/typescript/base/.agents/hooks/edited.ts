// Run after each file edit, and after each shell command, for every agent tool that runs hooks:
// formats the written files with Biome, applies ESLint's fixes to them and hands what's left to the
// agent at once, so a problem surfaces while the agent is in those files, not only at the stop check.
// When no language server saw the write (a shell command wrote the files, or the tool has none), it
// also type-checks the game, type errors first. It never lints other files: the stop check does. ESLint stays loaded in a server between edits (eslint-server.ts),
// so an edit takes a fraction of a second after the first. `.agents/hooks/run` starts it, with the
// tool's reply format as the argument: claude (also Codex's), cursor, copilot or gemini. Cursor shows
// nothing of what a hook prints after an edit, so there the fixes apply silently.

import { spawn } from "node:child_process";
import fs from "node:fs";
import module from "node:module";
import path from "node:path";
import { fixable, type Linted, lintViaServer } from "./eslint-server.ts";
import { GENERATED, namedFiles, type Payload, patched, toolInput } from "./guard.ts";
import { hintsFor } from "./hints.ts";
import { type Format, formatArg, projectRoot } from "./project.ts";
import { newSkills, skillNote } from "./skill-rules.ts";
import { isShell, lockTools, movesFiles, runsTask, shellStarted, writtenSince } from "./written.ts";

// What Biome formats; ESLint lints the TypeScript among them under src/ or projects/, as the check does.
const FORMATS = /\.(ts|tsx|js|mjs|cjs|json|jsonc)$/;
const LINTS = /^(src|projects)\/.+\.tsx?$/;

const MAX_PROBLEMS = 10;

/** The files this edit wrote, as the tool names them: relative to `start` or absolute. */
export function editedFiles(payload: Payload): string[] {
	const input = toolInput(payload);
	// Codex reports its edits as one apply_patch call, the patch in `command`.
	if ((payload.tool_name ?? payload.toolName) === "apply_patch") {
		return typeof input.command === "string" ? patched(input.command) : [];
	}
	return namedFiles(payload, input);
}

/** The edited files this hook handles, relative to the project root: inside it, not generated, of a kind Biome formats. */
export function filesToCheck(files: string[], root: string, start: string): string[] {
	const relative = files.map((file) => path.relative(root, path.resolve(start, file)).split(path.sep).join("/"));
	return [...new Set(relative)].filter(
		(file) =>
			!file.startsWith("../") &&
			!path.isAbsolute(file) &&
			FORMATS.test(file) &&
			!GENERATED.some(([pattern]) => pattern.test(file)),
	);
}

/** What to print for the tool, given the problems left after the fixes, or undefined to print nothing. */
export function editedOutput(format: Format, problems: string[], notes: string[] = []): object | undefined {
	if ((problems.length === 0 && notes.length === 0) || format === "cursor") return undefined;
	const shown = problems.slice(0, MAX_PROBLEMS);
	if (problems.length > MAX_PROBLEMS) shown.push(`...and ${problems.length - MAX_PROBLEMS} more`);
	const found =
		problems.length === 0
			? []
			: [`Problems left in what you just wrote (its formatting and safe fixes are applied):\n${shown.join("\n")}`];
	const message = [...notes, ...found].join("\n\n");
	switch (format) {
		case "copilot":
			return { additionalContext: message };
		case "gemini":
			return { hookSpecificOutput: { hookEventName: "AfterTool", additionalContext: message } };
		default:
			return { hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: message } };
	}
}

const relative = (file: string) => path.relative(process.cwd(), file).split(path.sep).join("/");

/** ESLint's messages for one file as `file:line rule: message`. */
export function eslintProblems(result: Linted): string[] {
	return result.messages.map((m) => `${relative(result.filePath)}:${m.line} ${m.ruleId ?? "error"}: ${m.message}`);
}

/** Biome's `--reporter=github` lines as `file:line biome(<category>): message`, relative to the root. */
export function biomeProblems(output: string, root: string): string[] {
	return [...output.matchAll(/^::error title=([^,\n]*),file=([^,\n]+),line=(\d+)[^\n]*?::(.*)$/gm)].map(
		([, title, file = "", line, message]) =>
			`${path.relative(root, path.resolve(root, file)).split(path.sep).join("/")}:${line} biome(${title}): ${message}`,
	);
}

/** Formats the files with Biome, which reports only what stops it: parse errors. */
function format(files: string[], root: string): Promise<string[]> {
	return new Promise((resolve) => {
		const biome = spawn(
			"biome",
			["check", "--write", "--reporter=github", "--no-errors-on-unmatched", "--files-ignore-unknown=true", ...files],
			{ shell: process.platform === "win32", stdio: ["ignore", "pipe", "ignore"] },
		);
		let output = "";
		biome.stdout.setEncoding("utf8").on("data", (chunk: string) => {
			output += chunk;
		});
		biome.on("error", () => resolve([]));
		biome.on("close", () => resolve(biomeProblems(output, root)));
	});
}

/**
 * Lints the files once `formatted` is done, applying the fixes that keep what the agent wrote. A
 * server that keeps ESLint loaded does it when it can (eslint-server.ts); otherwise it runs here.
 */
async function lint(files: string[], root: string, formatted: Promise<unknown>): Promise<Linted[]> {
	if (process.env.BASEPLATE_ESLINT_SERVER !== "0") {
		await formatted;
		const served = await lintViaServer(root, files);
		if (served !== undefined) return served;
	}
	const { ESLint } = await import("eslint");
	const eslint = new ESLint({
		fix: (message) => fixable(message.ruleId, false),
		warnIgnored: false,
	});
	await eslint.calculateConfigForFile(files[0] ?? "");
	await formatted;
	const results = await eslint.lintFiles(files);
	await ESLint.outputFixes(results);
	return results;
}

/** The compiler's type errors, one line each: `src/a.ts:3 TS2322: Type 'string' is not assignable…`. */
export function compilerProblems(output: string): string[] {
	const lines = output.split(/\r?\n/);
	return lines.flatMap((line, index) => {
		const error = /^error ([\w-]+): (.*)$/.exec(line);
		if (error === null) return [];
		const at = /-->\s+(\S+?):(\d+):\d+/.exec(lines[index + 1] ?? "");
		return [`${at === null ? "" : `${at[1]}:${at[2]} `}${error[1]}: ${error[2]}`];
	});
}

/** Compiles the game, after writing what new folders and the world change, and returns its type errors. */
function typeCheck(): Promise<string[]> {
	return new Promise((resolve) => {
		const child = spawn("mise", ["run", "--quiet", "compile"], {
			shell: process.platform === "win32",
			stdio: ["ignore", "pipe", "pipe"],
		});
		let text = "";
		child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
			text += chunk;
		});
		child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
			text += chunk;
		});
		child.on("error", () => resolve([]));
		child.on("close", (code) => {
			const problems = compilerProblems(text);
			// A failure the parser can't read still says something: its last lines.
			resolve(code === 0 ? [] : problems.length > 0 ? problems : [text.trim().split("\n").slice(-5).join("\n")]);
		});
	});
}

if (import.meta.main) {
	let payload: Payload = {};
	try {
		payload = JSON.parse(fs.readFileSync(0, "utf8")) as Payload;
	} catch {}
	const start = payload.cwd ?? payload.workspace_roots?.[0] ?? process.cwd();
	const root = projectRoot(start);
	if (root === undefined) process.exit(0);
	const replyFormat = formatArg(process.argv[2]);
	const shell = isShell(payload);
	let written: string[];
	let raw: string[];
	let moved = false;
	if (shell) {
		const input = toolInput(payload);
		const command = typeof input.command === "string" ? input.command : (payload.command ?? "");
		const since = shellStarted(root);
		if (since === undefined || runsTask(command)) process.exit(0);
		raw = writtenSince(root, since);
		written = filesToCheck(raw, root, root);
		moved = movesFiles(command);
	} else {
		raw = editedFiles(payload).map((file) => path.relative(root, path.resolve(start, file)).split(path.sep).join("/"));
		written = filesToCheck(raw, root, root);
	}
	const locked = lockTools(root, raw);
	// Codex and Gemini CLI load no rules for the files an agent works on: name the skill instead.
	const notes =
		process.argv[3] === "codex" || replyFormat === "gemini"
			? newSkills(root, raw, payload.session_id).map(skillNote)
			: [];
	// Who type-checks a write: Claude Code's language server sees what its edit tools write; nothing
	// does for a shell command, Codex's apply_patch or the other tools' edits. Cursor shows the agent
	// nothing a hook says, so a type check there would only cost time.
	const noServer = shell || replyFormat !== "claude" || (payload.tool_name ?? payload.toolName) === "apply_patch";
	const wantsTypes = noServer && replyFormat !== "cursor";
	const files = written.filter((file) => fs.existsSync(path.join(root, file)));
	// A move or a delete leaves no new file, but can break the imports of others: type-check then too.
	if (files.length === 0 && !(moved && wantsTypes)) {
		const output = editedOutput(replyFormat, locked, notes);
		if (output !== undefined) console.log(JSON.stringify(output));
		process.exit(0);
	}
	const typeChecks = wantsTypes && (moved || files.some((file) => LINTS.test(file)));
	process.chdir(root);
	// mise.toml's NODE_COMPILE_CACHE keeps the compiled ESLint and plugins; a game whose mise.toml
	// predates it gets the same cache here.
	if (process.env.NODE_COMPILE_CACHE === undefined) {
		module.enableCompileCache?.(path.join(root, "node_modules/.cache/node-compile-cache"));
	}

	// ESLint reads the files only once Biome is done with them; when this process has to load ESLint
	// itself, which takes most of the time, Biome formats meanwhile.
	const formatted = format(files, root);
	const problems: string[] = [];
	const linted = files.filter((file) => LINTS.test(file));
	try {
		const results = linted.length === 0 ? [] : await lint(linted, root, formatted);
		// When ESLint couldn't parse a file it says why itself, so Biome's version of it would repeat it.
		const unparsed = results.filter((r) => r.messages.some((m) => m.fatal === true)).map((r) => relative(r.filePath));
		problems.push(...(await formatted).filter((p) => !unparsed.some((file) => p.startsWith(`${file}:`))));
		problems.push(...results.flatMap(eslintProblems));
	} catch {
		problems.push(...(await formatted));
	}
	if (typeChecks) problems.unshift(...(await typeCheck()));
	problems.unshift(...locked);
	if (problems.length > 0) problems.push(...hintsFor(problems.join("\n")));
	const output = editedOutput(replyFormat, problems, notes);
	if (output !== undefined) console.log(JSON.stringify(output));
}
