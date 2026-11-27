import fs from "node:fs";
import path from "node:path";
import { templateExtras } from "../../base/template.ts";

// Add-ons, the way create-t3-app's installers work: each question offers the most popular
// libraries, plus "none" where the game can go without. The first question is the language, a fork
// in the road: TypeScript (roblox-ts) and Luau each have their own template,
// template/<language>/base, and their own questions, with the tools that language's developers use.
// A choice is a folder in template/<language>/extras/<question>/<choice>/ holding addon.json (see
// Manifest), AGENTS.md (its section for the game's AGENTS.md), files/ (copied over the game) and,
// for a choice that brings a tool, mise.toml (its pinned tools and tasks, added to the game's). The
// base template is the default choice of a question without "none" (the UI: React in TypeScript,
// Vide in Luau), so that choice has no folder.
export interface AddOn {
	/** The flag and the key in results, such as "state". */
	readonly name: string;
	/** What the flag's value is called in --help, such as "library". */
	readonly valueName: string;
	readonly question: string;
	readonly choices: readonly { readonly value: string; readonly label: string; readonly hint: string }[];
	/**
	 * The choice taken when none is given. Where it can't go with the other answers, as Reflex can't
	 * with Vide, the first choice that can is taken instead (see defaultFor).
	 */
	readonly defaultValue: string;
	readonly allowNone: boolean;
	/** A question about the project's shape (places, what Rojo manages), asked before the stack. */
	readonly shape?: boolean;
	/** What the question picks, for the summary of the recommended stack, such as "player data". */
	readonly topic: string;
}

export const NONE = "none";

export const languages = [
	{ value: "luau", label: "Luau", hint: "Rojo, Wally, StyLua, Selene and luau-lsp" },
	{ value: "typescript", label: "TypeScript", hint: "roblox-ts, with Flamework" },
] as const;

export type Language = (typeof languages)[number]["value"];

export const DEFAULT_LANGUAGE: Language = "luau";

export const isLanguage = (value: string): value is Language => languages.some((language) => language.value === value);

const LANGUAGE_NAMES: Record<Language, string> = { typescript: "TypeScript", luau: "Luau" };
export const languageName = (language: Language) => LANGUAGE_NAMES[language];

const places: AddOn = {
	name: "places",
	valueName: "layout",
	question: "One place, or several?",
	choices: [
		{ value: "single", label: "One place", hint: "the whole game in one place" },
		{ value: "multi", label: "Several places", hint: "a lobby and a game sharing code, each in projects/" },
	],
	defaultValue: "single",
	allowNone: false,
	shape: true,
	topic: "places",
};

const managed: AddOn = {
	name: "managed",
	valueName: "mode",
	question: "Should Rojo manage the whole place, or only the code?",
	choices: [
		{ value: "full", label: "The whole place", hint: "code and world are files, built and published from git" },
		{ value: "partial", label: "Only the code", hint: "Studio keeps the place and its world; files hold the code" },
	],
	defaultValue: "full",
	allowNone: false,
	shape: true,
	topic: "management",
};

const assets: AddOn = {
	name: "assets",
	topic: "asset uploads",
	valueName: "tool",
	question: "Which tool to upload images and sounds?",
	choices: [{ value: "asphalt", label: "Asphalt", hint: "uploads assets/ to Roblox and types their IDs" }],
	defaultValue: NONE,
	allowNone: true,
};

const release: AddOn = {
	name: "release",
	topic: "release builds",
	valueName: "tool",
	question: "Which tool to process release builds?",
	choices: [{ value: "darklua", label: "Darklua", hint: "minifies and optimizes the code you publish" }],
	defaultValue: NONE,
	allowNone: true,
};

/** Each language's questions, in the order they're asked and applied: the UI first. */
export const addOnsByLanguage: Record<Language, readonly AddOn[]> = {
	typescript: [
		{
			name: "ui",
			topic: "UI",
			valueName: "library",
			question: "Which UI library?",
			choices: [
				{ value: "react", label: "React", hint: "the most used" },
				{ value: "vide", label: "Vide", hint: "fine-grained reactivity, no re-renders" },
			],
			defaultValue: "react",
			allowNone: false,
		},
		places,
		managed,
		{
			name: "state",
			topic: "state",
			valueName: "library",
			question: "Which library for client state?",
			choices: [
				{ value: "reflex", label: "Reflex", hint: "a Redux-like store" },
				{ value: "charm", label: "Charm", hint: "signals, the most used" },
			],
			defaultValue: "reflex",
			allowNone: true,
		},
		{
			name: "data",
			topic: "player data",
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
			topic: "entities",
			valueName: "library",
			question: "Which library for entities and components?",
			choices: [
				{ value: "components", label: "Flamework Components", hint: "classes on tagged instances" },
				{ value: "jecs", label: "Jecs", hint: "an entity component system" },
			],
			defaultValue: NONE,
			allowNone: true,
		},
		assets,
		release,
	],
	luau: [
		{
			name: "ui",
			topic: "UI",
			valueName: "library",
			question: "Which UI library?",
			choices: [
				{ value: "vide", label: "Vide", hint: "fine-grained reactivity, no re-renders" },
				{ value: "react", label: "React", hint: "react-lua, the most used" },
			],
			defaultValue: "vide",
			allowNone: false,
		},
		places,
		managed,
		{
			name: "state",
			topic: "state",
			valueName: "library",
			question: "Which library for client state?",
			choices: [{ value: "charm", label: "Charm", hint: "signals, the most used" }],
			defaultValue: "charm",
			allowNone: true,
		},
		{
			name: "data",
			topic: "player data",
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
			topic: "entities",
			valueName: "library",
			question: "Which library for entities and components?",
			choices: [{ value: "jecs", label: "Jecs", hint: "an entity component system" }],
			defaultValue: NONE,
			allowNone: true,
		},
		assets,
		release,
	],
};

/** Every question of any language, once by name, the way the flags list them. */
export const allAddOns: readonly AddOn[] = [
	...new Map(
		Object.values(addOnsByLanguage)
			.flat()
			.map((addOn) => [addOn.name, addOn]),
	).values(),
];

/** The answers to a language's questions, by question name. */
export type AddOnChoices = Record<string, string>;

/** The values a question accepts, with "none" where it has one. */
export const valuesOf = (addOn: AddOn) => [
	...addOn.choices.map((choice) => choice.value),
	...(addOn.allowNone ? [NONE] : []),
];

/** Every value a flag accepts in any language. */
export const flagValuesOf = (name: string) => [
	...new Set(
		Object.values(addOnsByLanguage)
			.flat()
			.filter((addOn) => addOn.name === name)
			.flatMap(valuesOf),
	),
];

/**
 * The choice `addOn` takes when none is given, with `chosen` the other answers: its default, or,
 * where that can't go with them (Reflex with Vide), its first choice that can, else none.
 */
export function defaultFor(language: Language, addOn: AddOn, chosen: Partial<AddOnChoices>): string {
	const fits = (value: string) =>
		findConflict(language, { ...chosen, [addOn.name]: value } as AddOnChoices) === undefined;
	if (fits(addOn.defaultValue)) return addOn.defaultValue;
	return addOn.choices.map((choice) => choice.value).find(fits) ?? (addOn.allowNone ? NONE : addOn.defaultValue);
}

/** A language's answers: `given` where set, each question's default otherwise, in question order. */
export function choicesFor(language: Language, given: Partial<AddOnChoices>): AddOnChoices {
	const chosen: AddOnChoices = {};
	for (const addOn of addOnsByLanguage[language]) {
		const known = Object.fromEntries(
			Object.entries({ ...given, ...chosen }).filter(([, value]) => value !== undefined),
		);
		chosen[addOn.name] = given[addOn.name] ?? defaultFor(language, addOn, known);
	}
	return chosen;
}

/** Why a flag's value doesn't fit the language, such as Flamework Components in a Luau game. */
export function flagProblem(language: Language, given: Partial<AddOnChoices>): string | undefined {
	for (const [name, value] of Object.entries(given)) {
		if (value === undefined) continue;
		const addOn = addOnsByLanguage[language].find((candidate) => candidate.name === name);
		const values = addOn === undefined ? [] : valuesOf(addOn);
		if (values.includes(value)) continue;
		const takes = values.length === 0 ? "has no such question" : `takes ${values.join(", ")}`;
		return `--${name} ${value} isn't a ${languageName(language)} choice: a ${languageName(language)} game ${takes}.`;
	}
	return undefined;
}

interface Manifest {
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

const manifestOf = (language: Language, name: string, value: string): Manifest | undefined => {
	const file = path.join(templateExtras(language), name, value, "addon.json");
	return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as Manifest) : undefined;
};

/** Why the chosen add-ons can't go together, if they can't. */
export function findConflict(language: Language, chosen: AddOnChoices): string | undefined {
	for (const [name, value] of Object.entries(chosen)) {
		const conflicts = manifestOf(language, name, value)?.conflicts ?? {};
		for (const [other, reasons] of Object.entries(conflicts)) {
			const reason = reasons[chosen[other] ?? ""];
			if (reason !== undefined) return reason;
		}
	}
	return undefined;
}

/**
 * Applies each chosen add-on to the project in `dir`, in the order of the language's questions: the
 * UI first. What the managed question chooses goes last, so it changes the game as the other
 * add-ons have left it.
 */
export function installAddOns(dir: string, language: Language, chosen: AddOnChoices) {
	const questions = addOnsByLanguage[language];
	const ordered = [...questions.filter((q) => q.name !== "managed"), ...questions.filter((q) => q.name === "managed")];
	for (const addOn of ordered) {
		const name = addOn.name;
		const value = chosen[name] ?? addOn.defaultValue;
		const manifest = manifestOf(language, name, value);
		if (manifest === undefined) continue; // "none", or the base's own choice
		const from = path.join(templateExtras(language), name, value);
		const variant = manifest.byUi?.[chosen.ui ?? ""];
		const managedVariant = manifest.byManaged?.[chosen.managed ?? ""];

		for (const file of manifest.removeFiles ?? []) fs.rmSync(path.join(dir, file), { force: true, recursive: true });
		const files = path.join(from, "files");
		if (fs.existsSync(files)) fs.cpSync(files, dir, { recursive: true });
		if (managedVariant?.files !== undefined) fs.cpSync(path.join(from, managedVariant.files), dir, { recursive: true });
		for (const task of manifest.removeMiseTasks ?? []) removeMiseTask(dir, task);
		const remove = manifest.removeDependencies ?? [];
		if (language === "luau") {
			editWally(dir, "dependencies", variant?.dependencies ?? manifest.dependencies ?? {}, remove);
			editWally(dir, "server-dependencies", manifest.serverDependencies ?? {}, remove);
			editWally(dir, "dev-dependencies", {}, remove);
		} else {
			editPackage(dir, variant?.dependencies ?? manifest.dependencies ?? {}, remove);
		}
		const mise = path.join(from, "mise.toml");
		if (fs.existsSync(mise)) addMise(dir, fs.readFileSync(mise, "utf8"));
		for (const [file, imports] of Object.entries(manifest.imports ?? {})) addImports(path.join(dir, file), imports);
		const agents = fs.readFileSync(path.join(from, managedVariant?.agents ?? variant?.agents ?? "AGENTS.md"), "utf8");
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

/**
 * Adds what a main file starts. TypeScript: side-effect imports after its last import, so Flamework
 * starts what they define. Luau: `require(...)` entries after the last one in its list of modules.
 */
function addImports(file: string, imports: string[]) {
	const lines = fs.readFileSync(file, "utf8").split("\n");
	if (file.endsWith(".luau")) {
		const last = lines.findLastIndex((line) => /^\s+require\(/.test(line));
		if (last !== -1) {
			const indent = /^\s+/.exec(lines[last] ?? "")?.[0] ?? "\t";
			lines.splice(last + 1, 0, ...imports.map((module) => `${indent}require(${module}),`));
		} else {
			// An empty list, `= {}`: open it, and get the service the modules' paths start from.
			const empty = lines.findIndex((line) => /^local \w+: .* = \{\}$/.test(line));
			if (empty === -1) throw new Error(`${file} has no list of required modules to add to`);
			const service = "ServerScriptService";
			const needsService =
				imports.some((module) => module.startsWith(`${service}.`)) &&
				!lines.some((line) => line.startsWith(`local ${service} `));
			lines.splice(
				empty,
				1,
				...(needsService ? [`local ${service} = game:GetService("${service}")`, ""] : []),
				(lines[empty] ?? "").slice(0, -1),
				...imports.map((module) => `\trequire(${module}),`),
				"}",
			);
		}
	} else {
		const last = lines.findLastIndex((line) => line.startsWith("import "));
		lines.splice(last + 1, 0, ...imports.map((module) => `import "${module}";`));
	}
	fs.writeFileSync(file, lines.join("\n"));
}

/**
 * Adds packages to a table of wally.toml (`Charm = "littensy/charm@=0.11.1"`), sorted by alias, and
 * drops the aliases in `remove`. Adds the table when it's missing and has something to hold.
 */
function editWally(dir: string, table: string, add: Record<string, string>, remove: string[]) {
	const file = path.join(dir, "wally.toml");
	const toml = fs.readFileSync(file, "utf8");
	const header = `[${table}]`;
	const start = toml.indexOf(`${header}\n`);
	const bodyStart = start === -1 ? toml.length : start + header.length + 1;
	const next = toml.indexOf("\n[", bodyStart);
	const bodyEnd = start === -1 ? toml.length : next === -1 ? toml.length : next + 1;
	const entries = new Map<string, string>();
	for (const line of toml.slice(bodyStart, bodyEnd).split("\n")) {
		const match = /^\s*([\w-]+)\s*=\s*"([^"]*)"/.exec(line);
		if (match?.[1] !== undefined && match[2] !== undefined) entries.set(match[1], match[2]);
	}
	for (const [alias, spec] of Object.entries(add)) entries.set(alias, spec);
	for (const alias of remove) entries.delete(alias);
	if (start === -1 && entries.size === 0) return;
	const body = [...entries]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([alias, spec]) => `${alias} = "${spec}"\n`)
		.join("");
	const rest = toml.slice(bodyEnd);
	fs.writeFileSync(
		file,
		start === -1
			? `${toml.trimEnd()}\n\n${header}\n${body}`
			: `${toml.slice(0, bodyStart)}${body}${rest === "" ? "" : `\n${rest.replace(/^\n+/, "")}`}`,
	);
}

/** Removes `[tasks.<name>]` from the game's mise.toml, up to the next table. */
function removeMiseTask(dir: string, name: string) {
	const file = path.join(dir, "mise.toml");
	const mise = fs.readFileSync(file, "utf8");
	const header = [`[tasks.${name}]`, `[tasks."${name}"]`].find((candidate) => mise.includes(`\n${candidate}\n`));
	if (header === undefined) throw new Error(`mise.toml has no task ${name} to remove`);
	const start = mise.indexOf(`\n${header}\n`) + 1;
	const next = mise.indexOf("\n[", start);
	fs.writeFileSync(file, `${mise.slice(0, start)}${next === -1 ? "" : mise.slice(next + 1)}`.replace(/\n+$/, "\n"));
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
