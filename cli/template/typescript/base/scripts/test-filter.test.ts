import assert from "node:assert/strict";
import { test } from "node:test";
import { e2eSelected, parseTestArgs } from "./test-filter.ts";

test("takes no filter when given nothing", () => {
	assert.deepEqual(parseTestArgs([]), {});
});

test("reads the project file, a path pattern per positional argument and a name pattern", () => {
	assert.deepEqual(parseTestArgs(["place.project.json", "shop", "quests", "-t", "refuses"]), {
		project: "place.project.json",
		testPathPattern: "shop|quests",
		testNamePattern: "refuses",
	});
	assert.deepEqual(parseTestArgs(["--testPathPattern", "shop", "--testNamePattern=adds"]), {
		testPathPattern: "shop",
		testNamePattern: "adds",
	});
});

test("refuses an option it doesn't know, so a typo doesn't run everything", () => {
	assert.throws(() => parseTestArgs(["--only", "shop"]), /Unknown option --only/);
	assert.throws(() => parseTestArgs(["-t"]), /needs a value/);
});

test("runs every end-to-end test without a filter, those whose path matches a path pattern, and none for a name pattern alone", () => {
	assert.equal(e2eSelected("tests/e2e/shop.luau", {}), true);
	assert.equal(e2eSelected("tests/e2e/shop.luau", { testPathPattern: "shop|quests" }), true);
	assert.equal(e2eSelected("tests/e2e/shop.luau", { testPathPattern: "quests" }), false);
	assert.equal(e2eSelected("tests/e2e/shop.luau", { testNamePattern: "adds" }), false);
	assert.equal(e2eSelected("tests/e2e/shop.luau", { testPathPattern: "shop", testNamePattern: "adds" }), false);
});
