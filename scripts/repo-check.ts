// What the repository's own local loop shares: which checks a set of changed files needs, where a
// pass is recorded, and how a failure is shortened.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { stripVTControlCharacters } from "node:util";
import { docsOnly, isMarkdown } from "../.github/scripts/generate-matrix.ts";

/** The whole root check (the CLI and the docs site) last passed on this tree. */
export const ROOT_RECORD = "root-check-passed";
/** What a template's own check writes when it passes (in its folder's git record), read by the Stop hook. */
export const TEMPLATE_RECORD = "check-passed";
/** The docs-scoped check last passed on this tree: not a pass of the whole one. */
export const DOCS_RECORD = "root-docs-passed";

/**
 * How much of the root check a change needs: `full`, `docs` (the docs site, and the CLI's tests of
 * the docs and README) or `none`, for Markdown nothing reads.
 */
export type Scope = "none" | "docs" | "full";

/** Whether the CLI's tests or the docs site read this Markdown file. */
const readByChecks = (file: string) => file === "README.md" || file === "cli/README.md" || file.startsWith("www/");

export function scopeOf(files: string[]): Scope {
	if (files.length === 0) return "none";
	if (files.every((file) => isMarkdown(file) && !file.startsWith("cli/template/") && !readByChecks(file)))
		return "none";
	return docsOnly(files) ? "docs" : "full";
}

/**
 * The templates' bases (`cli/template/<language>/base`) whose own check these files need. A base
 * that only Markdown changed needs none: its check doesn't read Markdown.
 */
export function templatesOf(files: string[]): string[] {
	const bases = new Map<string, boolean>();
	for (const file of files) {
		const base = /^(cli\/template\/[^/]+\/base)\//.exec(file)?.[1];
		if (base !== undefined) bases.set(base, bases.get(base) === true || !isMarkdown(file));
	}
	return [...bases].filter(([, code]) => code).map(([base]) => base);
}

/** Lines of a failure's output that never say what broke: progress dots, turbo's banner, the test runner's own frames. */
const noise = /^(\S+:\s)?(\.+X?\.*|\s*at .*node:(internal|async_hooks).*|\s*[•]\s.*)$/;

/** The tail of a failure's output, without colors or noise: where the failing test or step says what broke. */
export function shorten(output: string, limit = 2400): string {
	const text = stripVTControlCharacters(output)
		.split("\n")
		.filter((line) => !noise.test(line.trimEnd()))
		.join("\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
	return text.length <= limit ? text : `...\n${text.slice(-limit).replace(/^[^\n]*\n/, "")}`;
}

/** This process's environment without the variables git sets for a hook (GIT_DIR, GIT_INDEX_FILE, ...), which would point a command run in another folder at this repository. */
export function withoutGitEnv(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
	return Object.fromEntries(Object.entries(env).filter(([name]) => !name.startsWith("GIT_")));
}

/** The files that decide what a dependency install gives. */
const INSTALL_FILES = ["package.json", "cli/package.json", "www/package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml"];

/**
 * Writes what the index holds (what a commit would contain) to `dir`, so it can be checked while the
 * working tree, with its unstaged edits, stays as it is. The installed packages are linked in rather
 * than installed again, unless a file that decides them differs between the index and the disk;
 * then they are left out and the caller installs.
 */
export function exportIndex(root: string, dir: string): { installed: boolean } {
	fs.rmSync(dir, { recursive: true, force: true });
	fs.mkdirSync(dir, { recursive: true });
	const run = (args: string[]) => spawnSync("git", args, { cwd: root, encoding: "utf8" });
	const exported = run(["checkout-index", "--all", `--prefix=${dir}${path.sep}`]);
	if (exported.status !== 0) throw new Error(`git checkout-index failed: ${exported.stderr}`);
	// The ignore rules of the index's own .gitignore, for tools that ask git.
	spawnSync("git", ["init", "--quiet"], { cwd: dir, env: withoutGitEnv() });
	const same = run(["diff", "--quiet", "--", ...INSTALL_FILES]).status === 0;
	if (!same) return { installed: false };
	for (const modules of ["node_modules", "cli/node_modules", "www/node_modules"]) {
		if (fs.existsSync(path.join(root, modules)))
			// A junction needs no privilege on Windows (a directory symlink needs Developer Mode); elsewhere it is a symlink.
			fs.symlinkSync(path.join(root, modules), path.join(dir, modules), "junction");
	}
	return { installed: true };
}
