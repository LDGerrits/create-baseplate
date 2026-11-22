import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** Files by path from the game's root, with `/` between folders. */
export type Files = Record<string, string>;

/**
 * What the template ships for agents, and keeps current in a game: its instructions, skills,
 * hooks and the agent tools' settings. Everything else in a game is the game's own once created.
 */
const AGENT_FILES = [
	/^AGENTS\.md$/,
	/^CLAUDE\.md$/,
	/^\.agents\//,
	/^\.claude\/settings\.json$/,
	/^\.claude\/plugins\//,
	/^\.codex\//,
	/^\.cursor\//,
	/^\.gemini\//,
	/^\.github\/hooks\//,
	/^\.github\/workflows\/copilot-setup-steps\.yml$/,
	/^\.devcontainer\//,
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

/** The agent files in a folder; symbolic links (such as `.claude/skills`) aren't files of their own. */
export function readAgentFiles(dir: string): Files {
	const files: Files = {};
	const walk = (folder: string) => {
		for (const entry of fs.readdirSync(path.join(dir, folder), { withFileTypes: true })) {
			const relative = folder === "" ? entry.name : `${folder}/${entry.name}`;
			if (entry.isDirectory()) {
				if (entry.name !== "node_modules" && entry.name !== ".git") walk(relative);
			} else if (entry.isFile() && !relative.endsWith(CLASH_SUFFIX) && AGENT_FILES.some((re) => re.test(relative))) {
				files[relative] = fs.readFileSync(path.join(dir, relative), "utf8");
			}
		}
	};
	walk("");
	return files;
}

export function readBase(dir: string): Base | undefined {
	const file = path.join(dir, BASE_FILE);
	return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as Base) : undefined;
}

export function writeBase(dir: string, base: Base) {
	const sorted = Object.fromEntries(Object.entries(base.files).sort(([a], [b]) => (a < b ? -1 : 1)));
	fs.mkdirSync(path.join(dir, path.dirname(BASE_FILE)), { recursive: true });
	fs.writeFileSync(path.join(dir, BASE_FILE), `${JSON.stringify({ ...base, files: sorted }, undefined, "\t")}\n`);
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
): SyncPlan {
	const plan: SyncPlan = { write: {}, remove: [], conflicts: [], base: {} };
	// The base moves on to the template's version, so once a person merges the two by hand and deletes
	// the .baseplate-new file, the next update keeps their result.
	const clash = (file: string, theirsText: string) => {
		plan.write[file + CLASH_SUFFIX] = theirsText;
		plan.conflicts.push(file);
		plan.base[file] = theirsText;
	};
	for (const file of [...new Set([...Object.keys(base), ...Object.keys(ours), ...Object.keys(theirs)])].sort()) {
		const [b, o, t] = [base[file], ours[file], theirs[file]];
		if (t === undefined) {
			// The template dropped it: delete it unless the game changed it, which makes it the game's own.
			if (o !== undefined && o === b) plan.remove.push(file);
			continue;
		}
		if (o === undefined) {
			// New in the template, or deleted by the game: add the first, remember the second.
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
	return plan;
}

/** Whether applying the plan would change anything in the game. */
export const planChanges = (plan: SyncPlan, before: Files) =>
	Object.keys(plan.write).length > 0 ||
	plan.remove.length > 0 ||
	JSON.stringify(Object.entries(plan.base).sort()) !== JSON.stringify(Object.entries(before).sort());

export function applyPlan(dir: string, plan: SyncPlan) {
	for (const [file, text] of Object.entries(plan.write)) {
		fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
		fs.writeFileSync(path.join(dir, file), text);
	}
	for (const file of plan.remove) {
		fs.rmSync(path.join(dir, file));
		// Up through the folders the deletion emptied, as git would leave them.
		for (let folder = path.dirname(file); folder !== "."; folder = path.dirname(folder)) {
			const at = path.join(dir, folder);
			if (fs.readdirSync(at).length > 0) break;
			fs.rmdirSync(at);
		}
	}
}
