import fs from "node:fs";
import path from "node:path";
import { TEMPLATE_EXTRAS } from "../consts.ts";

// Add-ons, the way create-t3-app's installers work: each question offers the most popular
// libraries, plus "none" where the game can go without. A choice is a folder in
// template/extras/<question>/<choice>/ holding addon.json (see Manifest), AGENTS.md (its section
// for the game's AGENTS.md), files/ (copied over the game) and, for a choice that brings a tool,
// mise.toml (its pinned tools and tasks, added to the game's). The base template is the default
// choice of a question without "none" (React, for the UI), so that choice has no folder.
export interface AddOn {
	/** The flag and the key in results, such as "state". */
	readonly name: string;
	/** What the flag's value is called in --help, such as "library". */
	readonly valueName: string;
	readonly question: string;
	readonly choices: readonly { readonly value: string; readonly label: string; readonly hint: string }[];
	/** The choice taken when none is given; "none" unless the question has no "none". */
	readonly defaultValue: string;
	readonly allowNone: boolean;
}

export const NONE = "none";

export const addOns = [
	{
		name: "ui",
		valueName: "library",
		question: "Which UI library?",
		choices: [
			{ value: "react", label: "React", hint: "the most used" },
			{ value: "vide", label: "Vide", hint: "fine-grained reactivity, no re-renders" },
		],
		defaultValue: "react",
		allowNone: false,
	},
	{
		name: "places",
		valueName: "layout",
		question: "One place, or several?",
		choices: [
			{ value: "single", label: "One place", hint: "the whole game in one place" },
			{ value: "multi", label: "Several places", hint: "a lobby and a game sharing code, laid out as Rogen does" },
		],
		defaultValue: "single",
		allowNone: false,
	},
	{
		name: "state",
		valueName: "library",
		question: "Which library for client state?",
		choices: [
			{ value: "charm", label: "Charm", hint: "signals, the most used" },
			{ value: "reflex", label: "Reflex", hint: "a Redux-like store; no longer updated" },
		],
		defaultValue: NONE,
		allowNone: true,
	},
	{
		name: "data",
		valueName: "library",
		question: "Which library to save player data?",
		choices: [
			{ value: "profilestore", label: "ProfileStore", hint: "the most used, with session locking" },
			{ value: "lapis", label: "Lapis", hint: "validated documents" },
		],
		defaultValue: NONE,
		allowNone: true,
	},
	{
		name: "entities",
		valueName: "library",
		question: "Which library for entities and components?",
		choices: [
			{ value: "components", label: "Flamework Components", hint: "classes on tagged instances" },
			{ value: "jecs", label: "Jecs", hint: "an entity component system" },
		],
		defaultValue: NONE,
		allowNone: true,
	},
	{
		name: "assets",
		valueName: "tool",
		question: "Which tool to upload images and sounds?",
		choices: [{ value: "asphalt", label: "Asphalt", hint: "uploads assets/ to Roblox and types their IDs" }],
		defaultValue: NONE,
		allowNone: true,
	},
	{
		name: "release",
		valueName: "tool",
		question: "Which tool to process release builds?",
		choices: [{ value: "darklua", label: "Darklua", hint: "minifies and optimizes the code you publish" }],
		defaultValue: NONE,
		allowNone: true,
	},
] as const satisfies readonly AddOn[];

export type AddOnChoices = Record<(typeof addOns)[number]["name"], string>;

/** The values a question accepts, with "none" where it has one. */
export const valuesOf = (addOn: AddOn) => [
	...addOn.choices.map((choice) => choice.value),
	...(addOn.allowNone ? [NONE] : []),
];

interface Manifest {
	/** Packages to add, pinned. */
	dependencies: Record<string, string>;
	/** Side-effect imports to add to a main file, so Flamework starts what they define. */
	imports: Record<string, string[]>;
	/** Packages the choice replaces, from dependencies or devDependencies. */
	removeDependencies?: string[];
	/** Base files the choice replaces. */
	removeFiles?: string[];
	/** The heading of the AGENTS.md section its AGENTS.md replaces, instead of adding a section. */
	replaceAgentsSection?: string;
	/** Exact text to replace in the game's files. */
	replaceText?: { file: string; from: string; to: string }[];
	/** What changes with another question's choice: `{ vide: { dependencies, files, agents } }` under the UI. */
	byUi?: Record<string, { dependencies?: Record<string, string>; files?: string; agents?: string }>;
	/** Choices of other questions this one can't go with, and why. */
	conflicts?: Record<string, Record<string, string>>;
}

const manifestOf = (name: string, value: string): Manifest | undefined => {
	const file = path.join(TEMPLATE_EXTRAS, name, value, "addon.json");
	return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as Manifest) : undefined;
};

/** Why the chosen add-ons can't go together, if they can't. */
export function findConflict(chosen: AddOnChoices): string | undefined {
	for (const [name, value] of Object.entries(chosen)) {
		const conflicts = manifestOf(name, value)?.conflicts ?? {};
		for (const [other, reasons] of Object.entries(conflicts)) {
			const reason = reasons[(chosen as Record<string, string>)[other] ?? ""];
			if (reason !== undefined) return reason;
		}
	}
	return undefined;
}

/** Applies each chosen add-on to the project in `dir`, in the order of `addOns`: the UI first. */
export function installAddOns(dir: string, chosen: AddOnChoices) {
	for (const addOn of addOns) {
		const name = addOn.name;
		const value = chosen[name];
		const manifest = manifestOf(addOn.name, value);
		if (manifest === undefined) continue; // "none", or the base's own choice
		const from = path.join(TEMPLATE_EXTRAS, addOn.name, value);
		const variant = manifest.byUi?.[chosen.ui];

		for (const file of manifest.removeFiles ?? []) fs.rmSync(path.join(dir, file), { force: true });
		fs.cpSync(path.join(from, variant?.files ?? "files"), dir, { recursive: true });
		editPackage(dir, variant?.dependencies ?? manifest.dependencies, manifest.removeDependencies ?? []);
		const mise = path.join(from, "mise.toml");
		if (fs.existsSync(mise)) addMise(dir, fs.readFileSync(mise, "utf8"));
		for (const [file, imports] of Object.entries(manifest.imports)) addImports(path.join(dir, file), imports);
		const agents = fs.readFileSync(path.join(from, variant?.agents ?? "AGENTS.md"), "utf8");
		if (manifest.replaceAgentsSection === undefined) addAgentsSection(dir, agents);
		else replaceAgentsSection(dir, manifest.replaceAgentsSection, agents);
		for (const { file, from: text, to } of manifest.replaceText ?? []) {
			const at = path.join(dir, file);
			const content = fs.readFileSync(at, "utf8");
			// A base change the manifest doesn't know about; fail rather than leave the old text.
			if (!content.includes(text)) throw new Error(`${name}: ${file} no longer has the text to replace: ${text}`);
			fs.writeFileSync(at, content.replace(text, to));
		}
	}
}

function editPackage(dir: string, add: Record<string, string>, remove: string[]) {
	const file = path.join(dir, "package.json");
	const pkg = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, Record<string, string> | undefined>;
	const sorted = (entries: Record<string, string>) =>
		Object.fromEntries(
			Object.entries(entries)
				.filter(([name]) => !remove.includes(name))
				.sort(([a], [b]) => a.localeCompare(b)),
		);
	pkg.dependencies = sorted({ ...pkg.dependencies, ...add });
	if (pkg.devDependencies !== undefined) pkg.devDependencies = sorted(pkg.devDependencies);
	fs.writeFileSync(file, `${JSON.stringify(pkg, undefined, "\t")}\n`);
}

/** Adds side-effect imports after the main file's last import, so Flamework starts what they define. */
function addImports(file: string, imports: string[]) {
	const lines = fs.readFileSync(file, "utf8").split("\n");
	const last = lines.findLastIndex((line) => line.startsWith("import "));
	lines.splice(last + 1, 0, ...imports.map((module) => `import "${module}";`));
	fs.writeFileSync(file, lines.join("\n"));
}

/** Replaces the section under `## <heading>` with the add-on's, up to the next `## ` heading. */
function replaceAgentsSection(dir: string, heading: string, section: string) {
	const file = path.join(dir, "AGENTS.md");
	const agents = fs.readFileSync(file, "utf8");
	const start = agents.indexOf(`\n## ${heading}\n`) + 1;
	if (start === 0) throw new Error(`AGENTS.md has no "## ${heading}" section to replace`);
	const next = agents.indexOf("\n## ", start + 1);
	const end = next === -1 ? agents.length : next + 1;
	fs.writeFileSync(file, `${agents.slice(0, start)}${section.trim()}\n\n${agents.slice(end)}`);
}

/** Puts the add-on's section before the Rogen section, which Rogen manages at the end of AGENTS.md. */
function addAgentsSection(dir: string, section: string) {
	const file = path.join(dir, "AGENTS.md");
	const agents = fs.readFileSync(file, "utf8");
	const marker = agents.indexOf("<!-- rogen -->");
	const at = marker === -1 ? agents.length : marker;
	fs.writeFileSync(file, `${agents.slice(0, at)}${section.trim()}\n\n${agents.slice(at)}`);
}

/**
 * Adds an add-on's mise.toml to the game's: the lines of its [tools] at the end of the game's
 * [tools], and its other tables, such as tasks, at the end of the file. Renovate updates the pins
 * in the add-on's file as it does any mise.toml.
 */
function addMise(dir: string, fragment: string) {
	const file = path.join(dir, "mise.toml");
	let mise = fs.readFileSync(file, "utf8");
	const tools = /^\[tools\]\n([\s\S]*?)(?=^\[|$(?![\s\S]))/m.exec(fragment);
	if (tools !== null) {
		const start = mise.indexOf("[tools]\n");
		if (start === -1) throw new Error("mise.toml has no [tools] table");
		const next = mise.indexOf("\n[", start);
		const end = mise.slice(0, next).trimEnd().length;
		mise = `${mise.slice(0, end)}\n${tools[1]?.trim()}${mise.slice(end)}`;
		fragment = fragment.replace(tools[0], "");
	}
	const rest = fragment.trim();
	fs.writeFileSync(file, `${mise.trimEnd()}\n${rest === "" ? "" : `\n${rest}\n`}`);
}
