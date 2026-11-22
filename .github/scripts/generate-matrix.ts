// The sets of add-ons CI creates games with, generated from the CLI's questions
// (cli/src/installers/index.ts) and the manifests' `conflicts`, so a new question or choice is
// tested without editing the workflow:
// - create: no add-ons, each choice alone, every question answered together (once per UI), and
//   then as few more as it takes for every two choices of different questions to meet in some game
//   (pairwise), which catches add-ons that break each other.
// - windows: no add-ons, and every question answered together.
// - engine: no add-ons, and as few games as it takes for each choice to run once in a real Roblox
//   server; the runs share one test place and go one at a time.
// `node .github/scripts/generate-matrix.ts` prints them; given a file, as CI gives "$GITHUB_OUTPUT", it
// also writes them there as JSON, the step's outputs `create`, `windows` and `engine`.
import fs from "node:fs";
import path from "node:path";
import { addOns, valuesOf } from "../../cli/src/installers/index.ts";

const EXTRAS = path.resolve(import.meta.dirname, "../../cli/template/extras");

/** One game's answers: the value for each question, by its name. */
export type Answers = Record<string, string>;

interface Question {
	name: string;
	defaultValue: string;
	/** Every value, the default first. */
	values: string[];
}

export const questions: Question[] = addOns.map((addOn) => ({
	name: addOn.name,
	defaultValue: addOn.defaultValue,
	values: [addOn.defaultValue, ...valuesOf(addOn).filter((value) => value !== addOn.defaultValue)],
}));

/** Pairs that can't go together, as "question=value" keys, from each manifest's `conflicts`. */
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

function pairKey(a: [string, string], b: [string, string]): string {
	return [a.join("="), b.join("=")].sort().join(" ");
}

/** Whether `answers`, complete or not, holds no two choices that conflict. */
export function allowed(answers: Answers): boolean {
	const entries = Object.entries(answers);
	return entries.every((a, i) => entries.slice(i + 1).every((b) => !conflicts.has(pairKey(a, b))));
}

const defaults = (): Answers => Object.fromEntries(questions.map((question) => [question.name, question.defaultValue]));

/** The flags that create a game with `answers`; defaults are left out. */
export function flagsOf(answers: Answers): string {
	return questions
		.filter((question) => answers[question.name] !== question.defaultValue)
		.map((question) => `--${question.name} ${answers[question.name]}`)
		.join(" ");
}

/** Every pair of values of two different questions that can go together. */
export function allPairs(): string[] {
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

export function pairsOf(answers: Answers): string[] {
	const entries = Object.entries(answers);
	return entries.flatMap((a, i) => entries.slice(i + 1).map((b) => pairKey(a, b)));
}

const singlesOf = (answers: Answers) => Object.entries(answers).map((entry) => entry.join("="));

/**
 * Adds games to `games` until each key of `wanted` (what `keysOf` returns for a game) is in one:
 * each new game starts from a missing key and takes, question by question, the value that adds the
 * most missing keys and conflicts with nothing so far (a greedy covering, like AETG).
 */
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
			// The value that covers the most, and among equals the default: what most games use.
			const best = question.values.reduce((a, b) => (gain(b) > gain(a) ? b : a));
			answers[question.name] = best;
		}
		games.push(answers);
		take(answers);
	}
	return games;
}

/** No add-ons. */
const none = defaults();

/** Each choice that isn't a default, alone. */
const alone = questions.flatMap((question) =>
	question.values.slice(1).map((value) => ({ ...defaults(), [question.name]: value })),
);

/**
 * Every question answered with a choice, not its default or "none", once per UI. Where a question
 * has several, the second game takes the next one, so both games differ as much as they can.
 */
const everything = (questions.find((question) => question.name === "ui")?.values ?? [""]).map((ui, i) => {
	const answers: Answers = { ...defaults(), ui };
	for (const question of questions) {
		if (question.name === "ui") continue;
		const choices = question.values.filter((value) => value !== question.defaultValue && value !== "none");
		const fits = choices.filter((value) => allowed({ ...answers, [question.name]: value }));
		answers[question.name] = fits[i % fits.length] ?? question.defaultValue;
	}
	return answers;
});

const unique = (games: Answers[]) => [...new Map(games.map((game) => [flagsOf(game), game])).values()];

export const matrices = {
	create: unique(cover(unique([none, ...alone, ...everything]), allPairs(), pairsOf)),
	windows: unique([none, everything.at(-1) ?? none]),
	engine: unique(
		cover(
			[none],
			questions.flatMap((question) => question.values.map((value) => `${question.name}=${value}`)),
			singlesOf,
		),
	),
};

if (import.meta.main) {
	const output = Object.fromEntries(
		Object.entries(matrices).map(([job, games]) => [job, JSON.stringify({ addOns: games.map(flagsOf) })]),
	);
	const outputFile = process.argv[2];
	if (outputFile !== undefined) {
		fs.appendFileSync(
			outputFile,
			Object.entries(output)
				.map(([job, json]) => `${job}=${json}\n`)
				.join(""),
		);
	}
	for (const [job, games] of Object.entries(matrices)) {
		console.log(`${job} (${games.length}):`);
		for (const game of games) console.log(`  ${flagsOf(game) || "(no add-ons)"}`);
	}
}
