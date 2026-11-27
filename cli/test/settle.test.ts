import assert from "node:assert/strict";
import { test } from "node:test";
import { settleChoices } from "../src/domain/add-ons/questions.ts";

test("settleChoices fills each question's default", () => {
	assert.deepEqual(settleChoices("luau", {}), {
		choices: {
			ui: "vide",
			places: "single",
			managed: "full",
			state: "charm",
			data: "none",
			entities: "none",
			assets: "none",
			release: "none",
		},
	});
});

test("settleChoices takes a default that fits the given choices", () => {
	const settled = settleChoices("typescript", { ui: "vide" });
	assert.ok("choices" in settled);
	assert.notEqual(settled.choices.state, "reflex");
});

test("settleChoices refuses a choice the language doesn't have", () => {
	assert.deepEqual(settleChoices("luau", { entities: "components" }), {
		problem: "--entities components isn't a Luau choice: a Luau game takes jecs, none.",
	});
});

test("settleChoices refuses choices that can't go together", () => {
	const settled = settleChoices("typescript", { ui: "vide", state: "reflex" });
	assert.ok("problem" in settled);
	assert.match(settled.problem, /Reflex/);
});
