import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { DEFAULT_LANGUAGE, type Language, languages } from "../../cli/src/domain/add-ons/language.ts";
import { addOnsByLanguage, choicesFor, valuesOf } from "../../cli/src/domain/add-ons/questions.ts";

const WEIGHT_PER_ADD_ON = 0.05;

/** One game's answers: the value for each question, by its name. */
export type Answers = Record<string, string>;

interface Question {
	name: string;
	defaultValue: string;
	values: string[];
}

function pairKey(a: [string, string], b: [string, string]): string {
	return [a.join("="), b.join("=")].sort().join(" ");
}

/** One language's questions, and the sets of games that cover them. */
export function generatorFor(language: Language) {
	const EXTRAS = path.resolve(import.meta.dirname, "../../cli/template", language, "extras");

	const questions: Question[] = addOnsByLanguage[language].map((addOn) => ({
		name: addOn.name,
		defaultValue: addOn.defaultValue,
		values: [addOn.defaultValue, ...valuesOf(addOn).filter((value) => value !== addOn.defaultValue)],
	}));

	const conflicts = new Set<string>();
	for (const question of questions) {
		for (const value of question.values) {
			const file = path.join(EXTRAS, question.name, value, "addon.json");
			if (!fs.existsSync(file)) continue;
			const manifest = JSON.parse(fs.readFileSync(file, "utf8")) as {
				conflicts?: Record<string, Record<string, string>>;
			};
			for (const [other, reasons] of Object.entries(manifest.conflicts ?? {})) {
				for (const otherValue of Object.keys(reasons)) {
					conflicts.add(pairKey([question.name, value], [other, otherValue]));
				}
			}
		}
	}

	/** Whether `answers`, complete or not, holds no two choices that conflict. */
	function allowed(answers: Answers): boolean {
		const entries = Object.entries(answers);
		return entries.every((a, i) => entries.slice(i + 1).every((b) => !conflicts.has(pairKey(a, b))));
	}

	const withDefaults = (answers: Answers = {}): Answers => choicesFor(language, answers);
	const defaults = () => withDefaults();

	/** The flags that create a game with `answers`; what the CLI would take anyway is left out. */
	function flagsOf(answers: Answers): string {
		const implied = (name: string) =>
			withDefaults(Object.fromEntries(Object.entries(answers).filter(([other]) => other !== name)))[name];
		return [
			...(language === DEFAULT_LANGUAGE ? [] : [`--language ${language}`]),
			...questions
				.filter((question) => answers[question.name] !== implied(question.name))
				.map((question) => `--${question.name} ${answers[question.name]}`),
		].join(" ");
	}

	/** Every pair of values of two different questions that can go together. */
	function allPairs(): string[] {
		const pairs: string[] = [];
		questions.forEach((a, i) => {
			for (const b of questions.slice(i + 1)) {
				for (const x of a.values) {
					for (const y of b.values) {
						const key = pairKey([a.name, x], [b.name, y]);
						if (!conflicts.has(key)) pairs.push(key);
					}
				}
			}
		});
		return pairs;
	}

	function pairsOf(answers: Answers): string[] {
		const entries = Object.entries(answers);
		return entries.flatMap((a, i) => entries.slice(i + 1).map((b) => pairKey(a, b)));
	}

	const singlesOf = (answers: Answers) => Object.entries(answers).map((entry) => entry.join("="));

	function cover(games: Answers[], wanted: string[], keysOf: (answers: Answers) => string[]): Answers[] {
		const missing = new Set(wanted);
		const take = (answers: Answers) => {
			for (const key of keysOf(answers)) missing.delete(key);
		};
		games.forEach(take);
		while (missing.size > 0) {
			const [first] = missing;
			const answers: Answers = {};
			for (const part of (first ?? "").split(" ")) {
				const [name = "", value = ""] = part.split("=");
				answers[name] = value;
			}
			for (const question of questions) {
				if (question.name in answers) continue;
				const gain = (value: string) => {
					const next = { ...answers, [question.name]: value };
					if (!allowed(next)) return -1;
					return keysOf(next).filter((key) => missing.has(key)).length;
				};
				const best = question.values.reduce((a, b) => (gain(b) > gain(a) ? b : a));
				answers[question.name] = best;
			}
			games.push(answers);
			take(answers);
		}
		return games;
	}

	const none = defaults();

	const alone = questions.flatMap((question) =>
		question.values.slice(1).map((value) => withDefaults({ [question.name]: value })),
	);

	const everything = (questions.find((question) => question.name === "ui")?.values ?? [""]).map((ui, i) => {
		const answers: Answers = withDefaults({ ui });
		for (const question of i % 2 === 0 ? questions : questions.toReversed()) {
			if (question.name === "ui") continue;
			const choices = question.values.filter((value) => value !== question.defaultValue && value !== "none");
			const fits = choices.filter((value) => allowed({ ...answers, [question.name]: value }));
			answers[question.name] = fits[i % fits.length] ?? question.defaultValue;
		}
		return answers;
	});

	const unique = (games: Answers[]) => [...new Map(games.map((game) => [flagsOf(game), game])).values()];

	const pull = unique(cover(unique([none, ...everything]), allPairs(), pairsOf));

	const matrices = {
		pull,
		full: unique(cover(unique([none, ...alone, ...everything]), allPairs(), pairsOf)),
		windows: unique([none, everything.at(-1) ?? none]),
		macos: [none],
		engine: unique(
			cover(
				[none],
				questions.flatMap((question) => question.values.map((value) => `${question.name}=${value}`)),
				singlesOf,
			),
		),
	};

	const weightOf = (answers: Answers) =>
		1 + WEIGHT_PER_ADD_ON * questions.filter((question) => answers[question.name] !== question.defaultValue).length;

	return { questions, allowed, allPairs, pairsOf, flagsOf, weightOf, matrices };
}

/** Each language's generator. */
export const generators = Object.fromEntries(
	languages.map((language) => [language.value, generatorFor(language.value)]),
) as Record<Language, ReturnType<typeof generatorFor>>;

export type Job = "pull" | "full" | "windows" | "macos" | "engine";

/** The sets of every language together, as the flags that create each game. */
export const allMatrices = Object.fromEntries(
	(["pull", "full", "windows", "macos", "engine"] as const).map((job) => [
		job,
		Object.values(generators).flatMap((generator) => generator.matrices[job].map(generator.flagsOf)),
	]),
) as Record<Job, string[]>;

/** The most games one job creates and checks. */
export const BATCH_SIZE = 6;

/** The oldest Node the CLI supports, as a full version: the CLI's `engines`, rounded to its first release. */
export const MIN_NODE = (() => {
	const range = (
		JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "../../cli/package.json"), "utf8")) as {
			engines: { node: string };
		}
	).engines.node;
	const version = range.replace(/^>=\s*/, "");
	return version.split(".").length === 2 ? `${version}.0` : version;
})();

/** What a job needs: the games to create and check, one after another, and a template to check first. */
export interface Batch {
	/** Shown in the job's name. */
	name: string;
	language: Language;
	/** The flags that create each game. */
	games: string[];
	/** Whether the job checks the language's template (cli/template/<language>/base) too. */
	template: boolean;
	/** The Node this batch runs the CLI under, when it isn't the default one. */
	node?: string;
}

/**
 * `games` of one language, in as few batches of at most `size` as it takes, balanced by what each is
 * expected to cost (the longest first into the lightest batch). The first batch also takes the
 * template's check, which counts as a game. Games keep their order within a batch.
 */
export function batchesOf(
	language: Language,
	games: { flags: string; weight: number }[],
	{ size = BATCH_SIZE, template = false } = {},
): Batch[] {
	const count = Math.max(1, Math.ceil((games.length + (template ? 1 : 0)) / size));
	const bins = Array.from({ length: count }, (_, index) => ({
		games: [] as { flags: string; weight: number; order: number }[],
		load: template && index === 0 ? 1 : 0,
		size: template && index === 0 ? 1 : 0,
	}));
	const ordered = games
		.map((game, order) => ({ ...game, order }))
		.sort((a, b) => b.weight - a.weight || a.order - b.order);
	for (const game of ordered) {
		const open = bins.filter((bin) => bin.size < size);
		const lightest = open.reduce((a, b) => (b.load < a.load ? b : a));
		lightest.games.push(game);
		lightest.load += game.weight;
		lightest.size += 1;
	}
	return bins.map((bin, index) => ({
		name: count === 1 ? language : `${language} ${index + 1}/${count}`,
		language,
		games: bin.games.sort((a, b) => a.order - b.order).map((game) => game.flags),
		template: template && index === 0,
	}));
}

/** The events whose runs differ. A push is to main; the others are by what triggered the run. */
export type Event = "pull_request" | "push" | "schedule" | "workflow_dispatch";
export const events: Event[] = ["pull_request", "push", "schedule", "workflow_dispatch"];

/** Whether a path is a Markdown file: the repository's one definition (the local check scopes by it too). */
export const isMarkdown = (file: string) => /\.md$/i.test(file);

/**
 * Whether `files` (a pull request's changed paths) are all the docs site (`www/`) or Markdown files
 * outside the templates (a template's Markdown files ship in every game). No files, or none known,
 * is not docs only.
 */
export function docsOnly(files: string[]): boolean {
	return (
		files.length > 0 &&
		files.every((file) => {
			if (file.startsWith("cli/template/")) return false;
			return file.startsWith("www/") || isMarkdown(file);
		})
	);
}

export interface Plan {
	/** The batches of games to create and check on Linux. */
	create: Batch[];
	/** The batches of games to create and check on Windows. */
	windows: Batch[];
	/** The batches of games to create and check on macOS: the nightly run and a run by hand only. */
	macos: Batch[];
	/** The flags of the games the engine job creates and runs in real Roblox. */
	engine: string[];
}

/**
 * What CI runs for a run of `event`. A pull request takes the pairwise sets, and the engine games only
 * from Renovate (`headRef` starts with renovate/), where an update that breaks only in the real engine
 * is what to find; the other events take the full sets and the engine. A pull request that changes only
 * the docs (`changedFiles`) creates no game.
 */
export function plan({
	event,
	headRef = "",
	changedFiles = [],
}: {
	event: Event;
	headRef?: string;
	changedFiles?: string[];
}): Plan {
	const pullRequest = event === "pull_request";
	if (pullRequest && docsOnly(changedFiles)) return { create: [], windows: [], macos: [], engine: [] };
	const extra = event === "schedule" || event === "workflow_dispatch";
	const create = pullRequest ? "pull" : "full";
	const batches = (job: "pull" | "full" | "windows" | "macos", template: boolean) =>
		Object.entries(generators).flatMap(([language, generator]) =>
			batchesOf(
				language as Language,
				generator.matrices[job].map((game) => ({ flags: generator.flagsOf(game), weight: generator.weightOf(game) })),
				{ template },
			),
		);
	const oldNode: Batch[] = extra
		? [
				{
					name: `node ${MIN_NODE}`,
					language: "typescript",
					games: generators.typescript.matrices.macos.map(generators.typescript.flagsOf),
					template: false,
					node: MIN_NODE,
				},
			]
		: [];
	return {
		create: [...batches(create, true), ...oldNode],
		windows: batches("windows", false),
		macos: extra ? batches("macos", false) : [],
		engine: !pullRequest || headRef.startsWith("renovate/") ? allMatrices.engine : [],
	};
}

/** The step's outputs: the matrices of the jobs, and whether each job runs. */
export function outputsOf(result: Plan): Record<string, string> {
	return {
		create: JSON.stringify({ include: result.create }),
		windows: JSON.stringify({ include: result.windows }),
		macos: JSON.stringify({ include: result.macos }),
		engine: JSON.stringify(result.engine),
		"run-create": String(result.create.length > 0),
		"run-windows": String(result.windows.length > 0),
		"run-macos": String(result.macos.length > 0),
		"run-engine": String(result.engine.length > 0),
	};
}

function describe(event: string, result: Plan): string {
	const lines = [`${event}:`];
	for (const [job, batches] of [
		["create", result.create],
		["windows", result.windows],
		["macos", result.macos],
	] as const) {
		const games = batches.reduce((sum, batch) => sum + batch.games.length, 0);
		lines.push(`  ${job}: ${games} games in ${batches.length} jobs`);
		for (const batch of batches) {
			lines.push(`    ${batch.name}${batch.template ? " (+ template)" : ""}: ${batch.games.length}`);
			for (const game of batch.games) lines.push(`      ${game || "(no add-ons)"}`);
		}
	}
	lines.push(`  engine: ${result.engine.length} games in ${result.engine.length > 0 ? 1 : 0} job`);
	for (const game of result.engine) lines.push(`    ${game || "(no add-ons)"}`);
	return lines.join("\n");
}

if (import.meta.main) {
	const { values, positionals } = parseArgs({
		allowPositionals: true,
		options: {
			event: { type: "string" },
			"head-ref": { type: "string", default: "" },
			"changed-files": { type: "string" },
		},
	});
	const changedFiles =
		values["changed-files"] === undefined
			? []
			: fs
					.readFileSync(values["changed-files"], "utf8")
					.split("\n")
					.filter((file) => file !== "");
	const outputFile = positionals[0];
	if (outputFile !== undefined) {
		const event = values.event as Event | undefined;
		if (event === undefined || !events.includes(event)) throw new Error(`--event is one of ${events.join(", ")}`);
		const outputs = outputsOf(plan({ event, headRef: values["head-ref"], changedFiles }));
		fs.appendFileSync(
			outputFile,
			Object.entries(outputs)
				.map(([name, value]) => `${name}=${value}\n`)
				.join(""),
		);
	}
	for (const event of values.event === undefined ? events : [values.event as Event]) {
		console.log(describe(event, plan({ event, headRef: values["head-ref"], changedFiles })));
	}
}
