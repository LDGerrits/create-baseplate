// CI's sets of created games (.github/scripts/generate-matrix.ts) cover what they promise.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
	type Answers,
	allowed,
	allPairs,
	flagsOf,
	matrices,
	pairsOf,
	questions,
} from "../../.github/scripts/generate-matrix.ts";
import { addOns } from "../src/installers/index.ts";

const flags = (games: Answers[]) => games.map(flagsOf);

test("creates a game with no add-ons, and with each choice alone", () => {
	const created = flags(matrices.create);
	assert.equal(created[0], "");
	for (const addOn of addOns) {
		for (const choice of addOn.choices) {
			if (choice.value !== addOn.defaultValue) assert.ok(created.includes(`--${addOn.name} ${choice.value}`));
		}
	}
});

test("creates a game with every question answered, once per UI", () => {
	for (const ui of ["react", "vide"]) {
		const all = matrices.create.find(
			(game) => game.ui === ui && questions.every((q) => q.name === "ui" || game[q.name] !== q.defaultValue),
		);
		assert.ok(all, `every question with ${ui}`);
	}
});

test("every two choices of different questions meet in some created game", () => {
	const covered = new Set(matrices.create.flatMap(pairsOf));
	const missing = allPairs().filter((pair) => !covered.has(pair));
	assert.deepEqual(missing, []);
});

test("creates no game the CLI would refuse, and stays small", () => {
	for (const games of Object.values(matrices)) {
		for (const game of games) assert.ok(allowed(game), flagsOf(game));
	}
	// It reads the manifests' conflicts, such as Reflex with Vide.
	assert.equal(allowed({ ui: "vide", state: "reflex" }), false);
	assert.ok(matrices.create.length <= 20, `${matrices.create.length} games`);
});

test("runs each choice once in the real engine", () => {
	const run = new Set(matrices.engine.flatMap((game) => Object.entries(game).map((entry) => entry.join("="))));
	for (const question of questions) {
		for (const value of question.values) assert.ok(run.has(`${question.name}=${value}`), `${question.name}=${value}`);
	}
});
