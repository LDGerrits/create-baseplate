// Run after each file edit, for every agent tool that runs hooks: formats the edited file (StyLua for
// Luau, Biome for JSON and the TypeScript tooling), lints edited Luau with Selene and hands what's
// left to the agent at once, so a lint error surfaces while the agent is in that file, not only at
// the stop check. It never runs the type checker or lints other files: the stop check does.
// `.agents/hooks/run` starts it, with the tool's reply format as the argument: claude (also
// Codex's), cursor, copilot or gemini. Cursor shows nothing of what a hook prints after an edit, so
// there the formatting applies silently.

import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { GENERATED, namedFiles, type Payload, patched, toolInput } from "./guard.ts";
import { type Format, formatArg, projectRoot } from "./project.ts";

// What StyLua formats; Selene lints those under src/, projects/ or tests/, as the check does.
const LUAU = /\.luau?$/;
const LINTS = /^(src|projects|tests)\/.+\.luau?$/;
// What changes the instances the sourcemaps map: a place's code (Luau and Rojo's JSON files), its
// world, and the *.rogen.json files that route the code.
const MAPPED = /^(projects\/[^/]+\/)?src\/.+\.(luau?|json)$/;
const RESHAPES = /^(projects\/[^/]+\/)?(world\/|[^/]+\.rogen\.json$)/;
// What Biome formats.
const BIOME = /\.(ts|js|mjs|cjs|json|jsonc)$/;

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

/** The edited files this hook handles, relative to the project root: inside it, not generated, of a kind StyLua or Biome formats. */
export function filesToCheck(files: string[], root: string, start: string): string[] {
	const relative = files.map((file) => path.relative(root, path.resolve(start, file)).split(path.sep).join("/"));
	return [...new Set(relative)].filter(
		(file) =>
			!file.startsWith("../") &&
			!path.isAbsolute(file) &&
			(LUAU.test(file) || BIOME.test(file)) &&
			!GENERATED.some(([pattern]) => pattern.test(file)),
	);
}

/** The files a sourcemap at `from` (a folder, from the project root) lists, from the project root. */
export function sourcemapFiles(sourcemap: unknown, from: string): string[] {
	const files: string[] = [];
	const visit = (node: { filePaths?: string[]; children?: unknown[] }) => {
		for (const file of node.filePaths ?? []) {
			const at = path.posix.join(from, file.replaceAll("\\", "/"));
			files.push(path.isAbsolute(file) ? file.replaceAll("\\", "/") : at);
		}
		for (const child of node.children ?? []) visit(child as typeof node);
	};
	visit(sourcemap as Parameters<typeof visit>[0]);
	return files;
}

/**
 * Whether the edited files (from the project root) change what the sourcemaps map: a code file none
 * of them lists, the world, or the routes. luau-lsp types every instance from sourcemap.json, so
 * until it's written again a new module or part is "not found" there. `known` holds the files the
 * sourcemaps list, from the project root or absolute; with none, there's nothing to keep current yet.
 */
export function sourcemapStale(files: string[], known: Set<string>, root: string): boolean {
	if (known.size === 0) return false;
	const listed = (file: string) => known.has(file) || known.has(path.posix.join(root.replaceAll("\\", "/"), file));
	return files.some((file) => RESHAPES.test(file) || (MAPPED.test(file) && !listed(file)));
}

/**
 * Writes the sourcemaps again, in the background, so the edit's reply doesn't wait: one run at a
 * time per project, and once more after it when another edit asked meanwhile.
 */
export function regenerate(root: string) {
	const lock = path.join(
		os.tmpdir(),
		`baseplate-generate-${createHash("sha256").update(root).digest("hex").slice(0, 8)}`,
	);
	fs.writeFileSync(`${lock}.again`, "");
	for (;;) {
		try {
			fs.mkdirSync(lock);
		} catch {
			// Another run holds it and will see the request, unless it died long ago.
			if (Date.now() - (fs.statSync(lock, { throwIfNoEntry: false })?.mtimeMs ?? 0) < 60_000) return;
			fs.rmSync(lock, { recursive: true, force: true });
			continue;
		}
		try {
			while (fs.existsSync(`${lock}.again`)) {
				fs.rmSync(`${lock}.again`, { force: true });
				spawnSync("mise", ["run", "--quiet", "--skip-deps", "generate"], {
					cwd: root,
					stdio: "ignore",
					shell: process.platform === "win32",
				});
			}
		} finally {
			fs.rmSync(lock, { recursive: true, force: true });
		}
		if (!fs.existsSync(`${lock}.again`)) return;
	}
}

/** What to print for the tool, given the problems left after the fixes, or undefined to print nothing. */
export function editedOutput(format: Format, problems: string[]): object | undefined {
	if (problems.length === 0 || format === "cursor") return undefined;
	const shown = problems.slice(0, MAX_PROBLEMS);
	if (problems.length > MAX_PROBLEMS) shown.push(`...and ${problems.length - MAX_PROBLEMS} more`);
	const message = `Lint problems left in what you just edited (its formatting is fixed already):\n${shown.join("\n")}`;
	switch (format) {
		case "copilot":
			return { additionalContext: message };
		case "gemini":
			return { hookSpecificOutput: { hookEventName: "AfterTool", additionalContext: message } };
		default:
			return { hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: message } };
	}
}

/** Biome's `--reporter=github` lines as `file:line biome(<category>): message`, relative to the root. */
export function biomeProblems(output: string, root: string): string[] {
	return [...output.matchAll(/^::error title=([^,\n]*),file=([^,\n]+),line=(\d+)[^\n]*?::(.*)$/gm)].map(
		([, title, file = "", line, message]) =>
			`${path.relative(root, path.resolve(root, file)).split(path.sep).join("/")}:${line} biome(${title}): ${message}`,
	);
}

/** StyLua's parse errors, `could not format file <file>: error parsing: ...`, as `file:line stylua: message`. */
export function styluaProblems(output: string, root: string): string[] {
	const problems: string[] = [];
	for (const [, file = "", detail = ""] of output.matchAll(
		/could not format file (.+?): error parsing:\s*\n((?:\s+- .*\n?)*)/g,
	)) {
		const name = path.relative(root, path.resolve(root, file)).split(path.sep).join("/");
		for (const [, message = "", line = ""] of detail.matchAll(/- (.*?) \((\d+):\d+ to [^)]*\)(.*)/g)) {
			problems.push(`${name}:${line} stylua: ${message.trim()}`);
		}
	}
	return problems;
}

interface SeleneDiagnostic {
	type?: string;
	severity?: string;
	code?: string;
	message?: string;
	primary_label?: { filename?: string; span?: { start_line?: number } };
}

/** Selene's `--display-style=json2` lines as `file:line selene(<code>): message`. */
export function seleneProblems(output: string): string[] {
	return output.split(/\r?\n/).flatMap((line) => {
		let diagnostic: SeleneDiagnostic;
		try {
			diagnostic = JSON.parse(line) as SeleneDiagnostic;
		} catch {
			return [];
		}
		if (diagnostic.type !== "Diagnostic") return [];
		const file = (diagnostic.primary_label?.filename ?? "").split(path.sep).join("/");
		const at = (diagnostic.primary_label?.span?.start_line ?? 0) + 1;
		return [`${file}:${at} selene(${diagnostic.code ?? "error"}): ${diagnostic.message ?? ""}`];
	});
}

/** Runs a tool on the files and returns what it printed; nothing when it isn't installed. */
function output(command: string, args: string[], stream: "stdout" | "stderr" | "both"): Promise<string> {
	return new Promise((resolve) => {
		const child = spawn(command, args, { shell: process.platform === "win32", stdio: ["ignore", "pipe", "pipe"] });
		let text = "";
		const take = (chunk: string) => {
			text += chunk;
		};
		if (stream !== "stderr") child.stdout.setEncoding("utf8").on("data", take);
		if (stream !== "stdout") child.stderr.setEncoding("utf8").on("data", take);
		child.on("error", () => resolve(""));
		child.on("close", () => resolve(text));
	});
}

if (import.meta.main && process.argv[2] === "--regenerate") {
	regenerate(process.argv[3] ?? process.cwd());
} else if (import.meta.main) {
	let payload: Payload = {};
	try {
		payload = JSON.parse(fs.readFileSync(0, "utf8")) as Payload;
	} catch {}
	const start = payload.cwd ?? payload.workspace_roots?.[0] ?? process.cwd();
	const root = projectRoot(start);
	if (root === undefined) process.exit(0);
	const files = filesToCheck(editedFiles(payload), root, start).filter((file) => fs.existsSync(path.join(root, file)));
	if (files.length === 0) process.exit(0);
	process.chdir(root);

	const luau = files.filter((file) => LUAU.test(file));
	const other = files.filter((file) => BIOME.test(file));
	const problems: string[] = [];
	// StyLua and Biome touch different files, so they run at once; Selene reads the Luau once StyLua is done.
	const [stylua, biome] = await Promise.all([
		luau.length === 0 ? "" : output("stylua", luau, "stderr"),
		other.length === 0
			? ""
			: output(
					"biome",
					[
						"check",
						"--write",
						"--reporter=github",
						"--no-errors-on-unmatched",
						"--files-ignore-unknown=true",
						...other,
					],
					"stdout",
				),
	]);
	const unparsed = styluaProblems(stylua, root);
	problems.push(...unparsed, ...biomeProblems(biome, root));
	// A file StyLua couldn't parse, Selene can't either; the parse error says enough.
	const linted = luau.filter((file) => LINTS.test(file) && !unparsed.some((p) => p.startsWith(`${file}:`)));
	if (linted.length > 0) {
		problems.push(
			...seleneProblems(await output("selene", ["--display-style=json2", "--no-summary", ...linted], "stdout")),
		);
	}
	// The language server reads the sourcemap again when it changes (.agents/hooks/luau-lsp.ts).
	const known = new Set<string>();
	for (const from of [
		".",
		...(fs.existsSync("projects") ? fs.readdirSync("projects").map((p) => `projects/${p}`) : []),
	]) {
		try {
			const sourcemap: unknown = JSON.parse(fs.readFileSync(path.join(from, "sourcemap.json"), "utf8"));
			for (const file of sourcemapFiles(sourcemap, from === "." ? "" : from)) known.add(file);
		} catch {}
	}
	if (sourcemapStale(files, known, root)) {
		spawn(process.execPath, [import.meta.filename, "--regenerate", root], { detached: true, stdio: "ignore" }).unref();
	}
	const reply = editedOutput(formatArg(process.argv[2]), problems);
	if (reply !== undefined) console.log(JSON.stringify(reply));
}
