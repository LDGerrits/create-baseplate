import assert from "node:assert/strict";
import { test } from "node:test";
import { firstCommit } from "../src/commands/create/outcome.ts";

const fresh = { packages: false, wally: false, tools: false };

test("firstCommit makes no commit without a repo", () => {
	assert.deepEqual(firstCommit({ state: "off" }, { state: "installed" }, fresh), { state: "no-repo" });
	assert.deepEqual(firstCommit({ state: "skipped", reason: "x" }, { state: "installed" }, fresh), { state: "no-repo" });
});

test("firstCommit commits now when installed, so the commit hook runs the check", () => {
	assert.deepEqual(firstCommit({ state: "repo" }, { state: "installed" }, { ...fresh, tools: true }), {
		state: "now",
		checked: true,
	});
});

test("firstCommit commits unchecked when nothing is installed and the lockfiles hold", () => {
	assert.deepEqual(firstCommit({ state: "repo" }, { state: "off" }, fresh), { state: "now", checked: false });
});

test("firstCommit waits for an install when the add-ons left lockfiles behind", () => {
	assert.deepEqual(
		firstCommit({ state: "repo" }, { state: "failed", error: "x" }, { ...fresh, tools: true, wally: true }),
		{
			state: "waiting",
			unlocked: [
				"mise.lock doesn't record the add-ons' tools until `mise lock`",
				"wally.lock doesn't list the add-ons' packages until `mise run install`",
			],
		},
	);
});
