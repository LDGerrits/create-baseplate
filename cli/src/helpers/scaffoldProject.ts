import fs from "node:fs";
import path from "node:path";
import { SYMLINKS_FILE, templateBase } from "../consts.ts";
import type { Language } from "../installers/index.ts";

/** What a new repo may already hold, from `git init`, GitHub's "Create repository" or the OS: kept. */
const KEPT = new Set([".git", "LICENSE", "LICENSE.md", "LICENSE.txt", ".DS_Store", "Thumbs.db"]);
/** Files GitHub can create that the template has its own of: replaced. */
const REPLACED = new Set(["README.md", ".gitignore", ".gitattributes"]);

/** Why the game can't be created in `dir`, if it can't. */
export function folderProblem(dir: string): string | undefined {
	if (!fs.existsSync(dir)) return undefined;
	if (!fs.statSync(dir).isDirectory()) return `${dir} is a file. Pick a folder.`;
	const others = fs.readdirSync(dir).filter((file) => !KEPT.has(file) && !REPLACED.has(file));
	return others.length === 0
		? undefined
		: `${dir} already has files in it (${others.join(", ")}). Pick a new folder, or empty this one.`;
}

/**
 * Copies the language's base template into `dir`, which must be missing, empty or a new repo (see
 * KEPT and REPLACED). Returns the files the template replaced.
 */
export function scaffoldProject(dir: string, language: Language): string[] {
	const problem = folderProblem(dir);
	if (problem !== undefined) throw new Error(problem);
	const present = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
	fs.cpSync(templateBase(language), dir, { recursive: true });

	// npm drops .gitignore files from packages, so the template ships them as _gitignore.
	for (const file of fs.readdirSync(dir, { recursive: true, encoding: "utf8" })) {
		if (path.basename(file) === "_gitignore") {
			fs.renameSync(path.join(dir, file), path.join(dir, path.dirname(file), ".gitignore"));
		}
	}

	// npm doesn't pack symbolic links either, so they're listed in a file and made here.
	const listFile = path.join(dir, SYMLINKS_FILE);
	const links = JSON.parse(fs.readFileSync(listFile, "utf8")) as Record<string, string>;
	fs.rmSync(listFile);
	for (const [link, target] of Object.entries(links)) {
		const at = path.join(dir, link);
		try {
			fs.symlinkSync(target, at);
		} catch {
			// Windows without the right to make symbolic links: copy what it points at.
			fs.cpSync(path.resolve(path.dirname(at), target), at, { recursive: true });
		}
	}
	return present.filter((file) => REPLACED.has(file));
}
