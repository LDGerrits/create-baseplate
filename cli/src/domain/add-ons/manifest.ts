import fs from "node:fs";
import path from "node:path";
import { templateExtras } from "../../base/template.ts";
import type { Language } from "./language.ts";

export interface Manifest {
	/**
	 * Packages to add, pinned: npm packages for package.json in TypeScript, Wally packages for
	 * wally.toml's [dependencies] in Luau (`{ "Charm": "littensy/charm@=0.11.1" }`).
	 */
	dependencies?: Record<string, string>;
	/** Luau: Wally packages only the server loads, for wally.toml's [server-dependencies]. */
	serverDependencies?: Record<string, string>;
	/**
	 * What a main file starts. TypeScript: side-effect imports, so Flamework starts what they define.
	 * Luau: require expressions added to the main script's list of services or controllers.
	 */
	imports?: Record<string, string[]>;
	/** Tasks of the game's mise.toml the choice removes, whatever other add-ons have done to them. */
	removeMiseTasks?: string[];
	/** Packages the choice replaces, from dependencies or devDependencies (by alias, in wally.toml). */
	removeDependencies?: string[];
	/** Base files or folders the choice replaces or drops. */
	removeFiles?: string[];
	/** The heading of the AGENTS.md section its AGENTS.md replaces, instead of adding a section. */
	replaceAgentsSection?: string;
	/** Exact text to replace in the game's files. */
	replaceText?: { file: string; from: string; to: string }[];
	/** What changes with the UI choice: `{ vide: { dependencies, agents } }`. */
	byUi?: Record<string, { dependencies?: Record<string, string>; agents?: string }>;
	/**
	 * What changes with the managed question's choice: `{ partial: { files, agents } }` copies that
	 * folder over `files/` and uses that file in place of `AGENTS.md` when Rojo manages only the code.
	 */
	byManaged?: Record<string, { files?: string; agents?: string }>;
	/** Choices of other questions this one can't go with, and why. */
	conflicts?: Record<string, Record<string, string>>;
}

export const manifestOf = (language: Language, name: string, value: string): Manifest | undefined => {
	const file = path.join(templateExtras(language), name, value, "addon.json");
	return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as Manifest) : undefined;
};
