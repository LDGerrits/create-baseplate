// Checks the built site (`pnpm build` first; turbo's test task does): every page also exists as
// Markdown for agents, llms.txt lists them in the sidebar's order, and the copies link to each other.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { SIDEBAR } from "../src/sidebar.ts";
import { SITE_URL } from "../src/site.ts";

const DOCS = path.resolve(import.meta.dirname, "../src/content/docs");
const DIST = path.resolve(import.meta.dirname, "../dist");

// Pages are Markdown files: `cli.md` is the page `cli`.
const pages = fs
	.readdirSync(DOCS, { recursive: true, encoding: "utf8" })
	.filter((file) => file.endsWith(".md"))
	.map((file) => file.slice(0, -".md".length).split(path.sep).join("/"));

const titleOf = (page: string) =>
	/^title:\s*["']?(.+?)["']?\s*$/m.exec(fs.readFileSync(path.join(DOCS, `${page}.md`), "utf8"))?.[1] ?? "";
const markdownOf = (page: string) => fs.readFileSync(path.join(DIST, `${page}.md`), "utf8");
const llms = () => fs.readFileSync(path.join(DIST, "llms.txt"), "utf8");

test("finds the pages", () => {
	assert.ok(pages.includes("index") && pages.includes("getting-started"), `found ${pages.join(", ")}`);
});

test("each page has a Markdown copy that starts with its title, not frontmatter", () => {
	for (const page of pages) {
		assert.ok(fs.existsSync(path.join(DIST, `${page}.md`)), `${page}.md is missing`);
		const markdown = markdownOf(page);
		assert.ok(markdown.startsWith(`# ${titleOf(page)}\n\n`), `${page}.md starts with its title`);
		assert.doesNotMatch(markdown, /^title:/m, `${page}.md has no frontmatter`);
	}
});

test("the sidebar lists every page, and llms.txt follows its order", () => {
	const listed = SIDEBAR.flatMap((group) => group.items);
	assert.deepEqual([...listed].sort(), pages.filter((page) => page !== "index").sort());
	assert.match(llms(), /^# Baseplate\n\n> /);
	const order = [...llms().matchAll(/\((?:https?:\/\/[^/)]+)?\/([\w/-]+)\.md\)/g)].map((match) => match[1]);
	assert.deepEqual(order, ["index", ...listed]);
});

test("llms.txt links by full URL once the site's address is set", () => {
	const links = [...llms().matchAll(/\]\(([^)]+)\)/g)].map((match) => match[1] ?? "");
	assert.ok(links.length > 0);
	for (const link of links) {
		if (SITE_URL === undefined) assert.match(link, /^\//);
		else assert.ok(link.startsWith(new URL("/", SITE_URL).href), link);
	}
});

test("llms-full.txt holds every page's Markdown copy, in llms.txt's order", () => {
	const full = fs.readFileSync(path.join(DIST, "llms-full.txt"), "utf8");
	assert.match(full, /^# Baseplate\n\n> /);
	let at = 0;
	for (const page of ["index", ...SIDEBAR.flatMap((group) => group.items)]) {
		const found = full.indexOf(markdownOf(page), at);
		assert.ok(found > at, `${page} follows the page before it`);
		at = found;
	}
});

test("links between pages stay in the Markdown copies", () => {
	assert.match(markdownOf("getting-started"), /\]\(\/cli\.md\)/);
	assert.doesNotMatch(markdownOf("getting-started"), /\]\(\/cli\/\)/);
});

test("the home page's copy keeps its tagline", () => {
	assert.match(markdownOf("index"), /agent-ready way to start a Roblox game, in roblox-ts or Luau\. One command/);
});

test("each page is built as HTML", () => {
	for (const page of pages) {
		const html = page === "index" ? "index.html" : `${page}/index.html`;
		assert.ok(fs.existsSync(path.join(DIST, html)), `${html} is missing`);
	}
});

test("the home page is its own page, and points agents at llms.txt", () => {
	const html = fs.readFileSync(path.join(DIST, "index.html"), "utf8");
	assert.match(html, /<h1[^>]*>The Roblox starter template built for AI coding agents\.<\/h1>/);
	assert.match(html, /href="\/llms\.txt"/);
	assert.match(html, /href="\/getting-started\/"/);
});
