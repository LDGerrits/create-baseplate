import assert from "node:assert/strict";
import { test } from "node:test";
import { hintsFor } from "./hints.ts";

test("names the fix for errors whose message doesn't say it, each once", () => {
	const output = [
		"error expectedMethodGotFunction: Attempted to assign non-method where method was expected.",
		"error TS2339: Property 'Humanoid' does not exist on type 'Model'.",
		"error TS2339: Property 'Torso' does not exist on type 'Model'.",
	].join("\n");
	const hints = hintsFor(output);
	assert.equal(hints.length, 2);
	assert.match(hints[0] ?? "", /write a method/);
	assert.match(hints[1] ?? "", /WaitForChild/);
});

test("a relative import that's missing is no package problem", () => {
	assert.deepEqual(
		hintsFor("error TS2307: Cannot find module './shop-service' or its corresponding type declarations."),
		[],
	);
	assert.equal(hintsFor("error TS2307: Cannot find module 'lodash' or its corresponding type declarations.").length, 1);
});
