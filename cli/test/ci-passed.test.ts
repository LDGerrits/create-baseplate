import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const filter = new URL("../../.github/scripts/ci-passed.jq", import.meta.url).pathname;
const hasJq = spawnSync("jq", ["--version"]).status === 0;

const passes = (event: string, results: Record<string, string>) => {
	const needs = Object.fromEntries(Object.entries(results).map(([job, result]) => [job, { result }]));
	return spawnSync("jq", ["-e", "--arg", "event", event, "-f", filter], { input: JSON.stringify(needs) }).status === 0;
};
const ok = { cli: "success", plan: "success", create: "success", windows: "success" };

test("every job a run needs must succeed or be skipped", { skip: !hasJq }, () => {
	assert.equal(passes("push", { ...ok, engine: "skipped" }), true);
	assert.equal(passes("pull_request", { ...ok, create: "skipped", windows: "skipped", engine: "skipped" }), true);
	for (const result of ["failure", "cancelled"]) {
		assert.equal(passes("push", { ...ok, create: result, engine: "success" }), false);
		assert.equal(passes("pull_request", { ...ok, windows: result, engine: "success" }), false);
	}
});

test("a failed engine job fails a pull request's CI, and nothing else's", { skip: !hasJq }, () => {
	assert.equal(passes("pull_request", { ...ok, engine: "failure" }), false);
	assert.equal(passes("pull_request", { ...ok, engine: "cancelled" }), false);
	for (const event of ["push", "schedule", "workflow_dispatch"]) {
		assert.equal(passes(event, { ...ok, engine: "failure" }), true, event);
		assert.equal(passes(event, { ...ok, engine: "cancelled" }), true, event);
	}
});
