// CI's sets of created games (.github/scripts/generate-matrix.ts) cover what they promise, in each language.
import assert from "node:assert/strict";
import { test } from "node:test";
import { type Answers, allMatrices, generators } from "../../.github/scripts/generate-matrix.ts";
import { addOnsByLanguage, DEFAULT_LANGUAGE, type Language } from "../src/installers/index.ts";

for (const [language, generator] of Object.entries(generators) as [Language, (typeof generators)[Language]][]) {
	const { allowed, allPairs, flagsOf, matrices, pairsOf, questions } = generator;
	const flags = (games: Answers[]) => games.map(flagsOf);
	const prefix = language === DEFAULT_LANGUAGE ? "" : `--language ${language}`;
	const withPrefix = (rest: string) => [prefix, rest].filter((part) => part !== "").join(" ");

	test(`${language}: creates a game with no add-ons, and with each choice alone`, () => {
		const created = flags(matrices.create);
		assert.equal(created[0], prefix);
		for (const addOn of addOnsByLanguage[language]) {
			for (const choice of addOn.choices) {
				if (choice.value !== addOn.defaultValue) {
					assert.ok(created.includes(withPrefix(`--${addOn.name} ${choice.value}`)), `--${addOn.name} ${choice.value}`);
				}
			}
		}
	});

	test(`${language}: creates a game with every question answered, once per UI`, () => {
		// A question whose only choice besides "none" is its default, such as Luau's state, answers with it.
		const onlyChoice = (q: (typeof questions)[number]) => q.values.filter((value) => value !== "none").length === 1;
		const uis = questions.find((question) => question.name === "ui")?.values ?? [];
		for (const ui of uis) {
			const all = matrices.create.find(
				(game) =>
					game.ui === ui &&
					questions.every(
						(q) => q.name === "ui" || (game[q.name] !== "none" && (onlyChoice(q) || game[q.name] !== q.defaultValue)),
					),
			);
			assert.ok(all, `every question with ${ui}`);
		}
	});

	test(`${language}: every two choices of different questions meet in some created game`, () => {
		const covered = new Set(matrices.create.flatMap(pairsOf));
		const missing = allPairs().filter((pair) => !covered.has(pair));
		assert.deepEqual(missing, []);
	});

	test(`${language}: creates no game the CLI would refuse, and stays small`, () => {
		for (const games of Object.values(matrices)) {
			for (const game of games) assert.ok(allowed(game), flagsOf(game));
		}
		assert.ok(matrices.create.length <= 20, `${matrices.create.length} games`);
	});

	test(`${language}: runs each choice once in the real engine`, () => {
		const run = new Set(matrices.engine.flatMap((game) => Object.entries(game).map((entry) => entry.join("="))));
		for (const question of questions) {
			for (const value of question.values) assert.ok(run.has(`${question.name}=${value}`), `${question.name}=${value}`);
		}
	});
}

test("reads the manifests' conflicts, such as Reflex with Vide", () => {
	assert.equal(generators.typescript.allowed({ ui: "vide", state: "reflex" }), false);
});

test("CI creates games of every language", () => {
	assert.ok(allMatrices.create.includes(""));
	assert.ok(allMatrices.create.includes("--language luau"));
	assert.ok(allMatrices.windows.includes("--language luau"));
});
