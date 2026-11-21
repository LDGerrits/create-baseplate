import fs from "node:fs";
import path from "node:path";
import { TEMPLATE_EXTRAS } from "../consts.ts";

// Add-ons, the way create-t3-app's installers work: each question offers the most popular
// libraries plus "none". A choice is a folder in template/extras/<question>/<choice>/ holding
// addon.json (packages, and imports for the main files), AGENTS.md (its section for the game's
// AGENTS.md), and files/ (copied over the game).
export interface AddOn {
	/** The flag and the key in results, such as "state". */
	readonly name: string;
	readonly question: string;
	readonly choices: readonly { readonly value: string; readonly label: string; readonly hint: string }[];
}

export const NONE = "none";

export const addOns = [
	{
		name: "state",
		question: "Which library for client state?",
		choices: [
			{ value: "charm", label: "Charm", hint: "signals, the most used" },
			{ value: "reflex", label: "Reflex", hint: "a Redux-like store; no longer updated" },
		],
	},
	{
		name: "data",
		question: "Which library to save player data?",
		choices: [
			{ value: "profilestore", label: "ProfileStore", hint: "the most used, with session locking" },
			{ value: "lapis", label: "Lapis", hint: "validated documents" },
		],
	},
	{
		name: "entities",
		question: "Which library for entities and components?",
		choices: [
			{ value: "components", label: "Flamework Components", hint: "classes on tagged instances" },
			{ value: "jecs", label: "Jecs", hint: "an entity component system" },
		],
	},
] as const satisfies readonly AddOn[];

export type AddOnChoices = Record<(typeof addOns)[number]["name"], string>;

/** The values a question accepts, "none" included. */
export const valuesOf = (addOn: AddOn) => [...addOn.choices.map((choice) => choice.value), NONE];

interface Manifest {
	dependencies: Record<string, string>;
	imports: Record<string, string[]>;
}

/** Applies each chosen add-on to the project in `dir`. */
export function installAddOns(dir: string, chosen: AddOnChoices) {
	for (const [name, value] of Object.entries(chosen)) {
		if (value === NONE) continue;
		const from = path.join(TEMPLATE_EXTRAS, name, value);
		const manifest = JSON.parse(fs.readFileSync(path.join(from, "addon.json"), "utf8")) as Manifest;

		fs.cpSync(path.join(from, "files"), dir, { recursive: true });
		addDependencies(dir, manifest.dependencies);
		for (const [file, imports] of Object.entries(manifest.imports)) addImports(path.join(dir, file), imports);
		addAgentsSection(dir, fs.readFileSync(path.join(from, "AGENTS.md"), "utf8"));
	}
}

function addDependencies(dir: string, dependencies: Record<string, string>) {
	const file = path.join(dir, "package.json");
	const pkg = JSON.parse(fs.readFileSync(file, "utf8")) as { dependencies?: Record<string, string> };
	const merged = { ...pkg.dependencies, ...dependencies };
	pkg.dependencies = Object.fromEntries(Object.entries(merged).sort(([a], [b]) => a.localeCompare(b)));
	fs.writeFileSync(file, `${JSON.stringify(pkg, undefined, "\t")}\n`);
}

/** Adds side-effect imports after the main file's last import, so Flamework starts what they define. */
function addImports(file: string, imports: string[]) {
	const lines = fs.readFileSync(file, "utf8").split("\n");
	const last = lines.findLastIndex((line) => line.startsWith("import "));
	lines.splice(last + 1, 0, ...imports.map((module) => `import "${module}";`));
	fs.writeFileSync(file, lines.join("\n"));
}

/** Puts the add-on's section before the Rogen section, which Rogen manages at the end of AGENTS.md. */
function addAgentsSection(dir: string, section: string) {
	const file = path.join(dir, "AGENTS.md");
	const agents = fs.readFileSync(file, "utf8");
	const marker = agents.indexOf("<!-- rogen -->");
	const at = marker === -1 ? agents.length : marker;
	fs.writeFileSync(file, `${agents.slice(0, at)}${section.trim()}\n\n${agents.slice(at)}`);
}
