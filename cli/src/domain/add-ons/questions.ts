import { type Language, languageName } from "./language.ts";
import { manifestOf } from "./manifest.ts";

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

/** Whether Rojo manages the whole place, world included, or only the code (the managed question). */
export type Managed = "full" | "partial";

export const managedOf = (chosen: AddOnChoices): Managed => (chosen.managed === "partial" ? "partial" : "full");

export const isMultiPlace = (chosen: AddOnChoices) => chosen.places === "multi";

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
 * A language's answers from the choices given, each missing one its default, or why they can't
 * make a game: a choice the language doesn't have, or choices that can't go together.
 */
export function settleChoices(
	language: Language,
	given: Partial<AddOnChoices>,
): { choices: AddOnChoices } | { problem: string } {
	const problem = flagProblem(language, given);
	if (problem !== undefined) return { problem };
	const choices = choicesFor(language, given);
	const conflict = findConflict(language, choices);
	return conflict === undefined ? { choices } : { problem: conflict };
}
