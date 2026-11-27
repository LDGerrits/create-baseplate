import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DOCS_DIR } from "../../base/template.ts";

/** Files by path from the game's root, with `/` between folders. */
export type Files = Record<string, string>;

// Workflows stay out: pushing one needs a GitHub App with the Workflows permission, which the
// update's workflow doesn't ask for.
const MOVED_SINCE_0_3_0 = [/^CLAUDE\.md$/];
const AGENT_FILES = [
	...MOVED_SINCE_0_3_0,
	/^AGENTS\.md$/,
	/^\.claude\/CLAUDE\.md$/,
	/^\.agents\//,
	/^\.claude\/settings\.json$/,
	/^\.claude\/plugins\//,
	/^\.claude\/rules\//,
	/^\.codex\//,
	/^\.cursor\//,
	/^\.gemini\//,
	/^\.github\/hooks\//,
	/^\.github\/instructions\//,
	/^\.devcontainer\//,
	/^scripts\/agent-files\.ts$/,
	/^scripts\/doc\.ts$/,
];
const AGENT_FOLDERS = [
	".agents",
	".claude",
	".codex",
	".cursor",
	".gemini",
	".github/hooks",
	".github/instructions",
	".devcontainer",
	"scripts",
];

/** Where a game records its agent files as the template last wrote them, the base of a three-way update. */
export const BASE_FILE = ".baseplate/agent-files.json";
/** Beside a file whose update clashed with the game's own edit: the template's version, for a person to merge. */
export const CLASH_SUFFIX = ".baseplate-new";

export interface Base {
	/** The create-baseplate whose template wrote the files. */
	version: string;
	files: Files;
}

export interface AgentFiles {
	files: Files;
	/** Agent files with a clash left beside them (`<file>.baseplate-new`) that no one has merged yet. */
	clashes: string[];
	/** The files that are executable, such as hook scripts. */
	executable: Set<string>;
}

const isAgentFile = (relative: string) => AGENT_FILES.some((re) => re.test(relative));

/**
 * The agent files in a game or a rendered template. Symbolic links (such as `.claude/skills`)
 * aren't files of their own, and nested checkouts (an agent's worktree under `.claude/worktrees`)
 * are their own games.
 */
export function readAgentFiles(dir: string): AgentFiles {
	const found: AgentFiles = { files: {}, clashes: [], executable: new Set() };
	const visit = (relative: string, entry: fs.Dirent) => {
		if (entry.isDirectory()) {
			if (!fs.existsSync(path.join(dir, relative, ".git")) && relative !== ".claude/worktrees") walk(relative);
		} else if (entry.isFile()) {
			const clashed = relative.endsWith(CLASH_SUFFIX) ? relative.slice(0, -CLASH_SUFFIX.length) : undefined;
			if (clashed !== undefined) {
				if (isAgentFile(clashed)) found.clashes.push(clashed);
			} else if (isAgentFile(relative)) {
				const at = path.join(dir, relative);
				found.files[relative] = fs.readFileSync(at, "utf8");
				if ((fs.statSync(at).mode & 0o111) !== 0) found.executable.add(relative);
			}
		}
	};
	const walk = (folder: string) => {
		for (const entry of fs.readdirSync(path.join(dir, folder), { withFileTypes: true })) {
			visit(`${folder}/${entry.name}`, entry);
		}
	};
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		if (entry.isFile()) visit(entry.name, entry);
	}
	for (const folder of AGENT_FOLDERS) {
		if (fs.existsSync(path.join(dir, folder)) && fs.statSync(path.join(dir, folder)).isDirectory()) walk(folder);
	}
	return found;
}

export function readBase(dir: string): Base | undefined {
	const file = path.join(dir, BASE_FILE);
	return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as Base) : undefined;
}

export function writeBase(dir: string, base: Base) {
	const sorted = Object.fromEntries(Object.entries(base.files).sort(([a], [b]) => (a < b ? -1 : 1)));
	fs.mkdirSync(path.join(dir, path.dirname(BASE_FILE)), { recursive: true });
	fs.writeFileSync(path.join(dir, BASE_FILE), `${JSON.stringify({ ...base, files: sorted }, undefined, "\t")}\n`);
	// The record holds every agent file's text again; searches (ripgrep, and the agent tools built on
	// it) skip it, so a search for a rule finds AGENTS.md once.
	fs.writeFileSync(
		path.join(dir, path.dirname(BASE_FILE), ".ignore"),
		`# What create-baseplate sync merges against, and this version's docs (\`mise run doc\` reads them);\n# not for searching.\n${path.basename(BASE_FILE)}\ndocs/\n`,
	);
	const docs = path.join(dir, path.dirname(BASE_FILE), "docs");
	if (fs.existsSync(DOCS_DIR)) {
		fs.rmSync(docs, { recursive: true, force: true });
		fs.cpSync(DOCS_DIR, docs, { recursive: true });
	}
}

/** A line-based three-way merge (git's), or undefined when the two sides change the same lines. */
export function mergeText(ours: string, base: string, theirs: string): string | undefined {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "baseplate-merge-"));
	try {
		const write = (name: string, text: string) => {
			fs.writeFileSync(path.join(dir, name), text);
			return path.join(dir, name);
		};
		const run = spawnSync(
			"git",
			["merge-file", "-p", write("ours", ours), write("base", base), write("theirs", theirs)],
			{
				encoding: "utf8",
			},
		);
		if (run.error !== undefined) throw run.error;
		return run.status === 0 ? run.stdout : undefined;
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
}

export interface SyncPlan {
	/** Files to write, by path; a clash writes the template's version beside the game's. */
	write: Files;
	remove: string[];
	/** Files where the game's edit and the template's change touch the same lines. */
	conflicts: string[];
	/** The base to record for the next update. */
	base: Files;
}

/**
 * Brings the template's changes to the agent files into the game's, as git merges a branch: `base`
 * is what the template wrote last time, `ours` the game's files now, `theirs` what the template
 * writes now. A file the game didn't touch takes the template's version; an edit the template
 * didn't touch stays; edits to different lines merge; a file the game deleted stays deleted.
 */
export function planSync(
	base: Files,
	ours: Files,
	theirs: Files,
	merge: (ours: string, base: string, theirs: string) => string | undefined,
	/** Files with an earlier clash beside them that no one has merged yet. */
	unmerged: string[] = [],
): SyncPlan {
	const plan: SyncPlan = { write: {}, remove: [], conflicts: [], base: {} };
	const clash = (file: string, theirsText: string) => {
		plan.write[file + CLASH_SUFFIX] = theirsText;
		plan.conflicts.push(file);
		plan.base[file] = theirsText;
	};
	for (const file of [...new Set([...Object.keys(base), ...Object.keys(ours), ...Object.keys(theirs)])].sort()) {
		const [b, o, t] = [base[file], ours[file], theirs[file]];
		if (t === undefined) {
			if (o !== undefined && o === b) plan.remove.push(file);
			continue;
		}
		if (o === undefined) {
			if (b === undefined) plan.write[file] = t;
			plan.base[file] = t;
			continue;
		}
		if (o === t || t === b) {
			plan.base[file] = t;
			continue;
		}
		if (b === undefined) {
			clash(file, t);
			continue;
		}
		if (o === b) {
			plan.write[file] = t;
			plan.base[file] = t;
			continue;
		}
		const merged = merge(o, b, t);
		if (merged === undefined) {
			clash(file, t);
		} else {
			if (merged !== o) plan.write[file] = merged;
			plan.base[file] = t;
		}
	}
	for (const file of unmerged) {
		if (plan.conflicts.includes(file)) continue;
		const t = theirs[file];
		if (t === undefined || ours[file] === t) plan.remove.push(file + CLASH_SUFFIX);
		else {
			plan.write[file + CLASH_SUFFIX] = t;
			plan.conflicts.push(file);
		}
	}
	return plan;
}

/** Whether applying the plan would change anything in the game. */
export const planChanges = (plan: SyncPlan, before: Files) =>
	Object.keys(plan.write).length > 0 ||
	plan.remove.length > 0 ||
	JSON.stringify(Object.entries(plan.base).sort()) !== JSON.stringify(Object.entries(before).sort());

/** Writes the plan into the game; `executable` are the template's executable files, which stay so. */
export function applyPlan(dir: string, plan: SyncPlan, executable: Set<string>) {
	for (const [file, text] of Object.entries(plan.write)) {
		fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
		fs.writeFileSync(path.join(dir, file), text);
		if (executable.has(file)) fs.chmodSync(path.join(dir, file), 0o755);
	}
	for (const file of plan.remove) {
		fs.rmSync(path.join(dir, file));
		for (let folder = path.dirname(file); folder !== "."; folder = path.dirname(folder)) {
			const at = path.join(dir, folder);
			if (fs.readdirSync(at).length > 0) break;
			fs.rmdirSync(at);
		}
	}
}

/** Records the agent files a new game starts with, the base its later updates merge against. */
export function recordAgentFiles(dir: string, version: string) {
	writeBase(dir, { version, files: readAgentFiles(dir).files });
}
