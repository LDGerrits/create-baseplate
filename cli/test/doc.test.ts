// `create-baseplate doc`, through the built CLI and the docs it ships.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { SIDEBAR } from "../../www/src/sidebar.ts";
import { closestTopic } from "../src/doc/command.ts";

const CLI = path.resolve(import.meta.dirname, "../dist/index.js");
const doc = (...args: string[]) => spawnSync("node", [CLI, "doc", ...args], { encoding: "utf8" });
const PAGES = SIDEBAR.flatMap((group) => group.items);

test("lists every page of the sidebar as a topic", () => {
	const run = doc("--json");
	assert.equal(run.status, 0, run.stderr);
	const result = JSON.parse(run.stdout) as { ok: boolean; topics: { topic: string; description: string }[] };
	assert.equal(result.ok, true);
	assert.deepEqual(
		result.topics.map((topic) => topic.topic),
		PAGES,
	);
	for (const topic of result.topics) assert.notEqual(topic.description, "", topic.topic);
});

test("prints a page without its frontmatter, with links to other pages as commands", () => {
	const run = doc("agents");
	assert.equal(run.status, 0, run.stderr);
	assert.match(run.stdout, /^# How agents work in it\n\n/);
	assert.doesNotMatch(run.stdout, /^---$/m);
	assert.doesNotMatch(run.stdout, /\]\(\/[\w-]+\/(#[^)]*)?\)/);
	const page = fs.readFileSync(path.resolve(import.meta.dirname, "../../www/src/content/docs/cli.md"), "utf8");
	if (page.includes("](/agents/")) assert.match(doc("cli").stdout, /\(create-baseplate doc agents\)/);
});

test("refuses an unknown topic and names the closest", () => {
	const run = doc("testng", "--json");
	assert.equal(run.status, 1);
	assert.match((JSON.parse(run.stdout) as { error: string }).error, /create-baseplate doc testing/);
});

test("finds the topic a name was meant to be", () => {
	assert.equal(closestTopic("trouble", PAGES), "troubleshooting");
	assert.equal(closestTopic("publsh", PAGES), "publishing");
	assert.equal(closestTopic("zzzz", PAGES), undefined);
});
