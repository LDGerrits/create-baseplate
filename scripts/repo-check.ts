// What the repository's own local loop shares: which checks a set of changed files needs, where a
// pass is recorded, and how a failure is shortened. The pieces are used by the check (scripts/check.ts),
// the commit hook (scripts/pre-commit.ts) and Claude Code's Stop hook (.claude/hooks/check.ts).
//
// A pass is recorded the way a created game's check does it (the template's .agents/hooks/fingerprint.ts):
// the git tree it passed on, in this worktree's git folder, so a later run on the same state is skipped.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { stripVTControlCharacters } from "node:util";
import { docsOnly } from "../.github/scripts/generate-matrix.ts";

export {
	alreadyPassed,
	CHECK_RECORD,
	readRecord,
	recordFile,
	stateId,
	writeRecord,
} from "../cli/template/typescript/base/.agents/hooks/fingerprint.ts";

/** The whole root check (the CLI and the docs site) last passed on this tree. */
export const ROOT_RECORD = "root-check-passed";
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
	if (files.every((file) => /\.md$/i.test(file) && !file.startsWith("cli/template/") && !readByChecks(file)))
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
		if (base !== undefined) bases.set(base, bases.get(base) === true || !/\.md$/i.test(file));
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
	spawnSync("git", ["init", "--quiet"], { cwd: dir });
	const same = run(["diff", "--quiet", "--", ...INSTALL_FILES]).status === 0;
	if (!same) return { installed: false };
	for (const modules of ["node_modules", "cli/node_modules", "www/node_modules"]) {
		if (fs.existsSync(path.join(root, modules)))
			fs.symlinkSync(path.join(root, modules), path.join(dir, modules), "dir");
	}
	return { installed: true };
}
