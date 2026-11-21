// Checks the built site (`pnpm build` first; turbo's test task does): every page also exists as
// Markdown for agents, and llms.txt lists them all.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

const DOCS = path.resolve(import.meta.dirname, "../src/content/docs");
const DIST = path.resolve(import.meta.dirname, "../dist");

const pages = fs
	.readdirSync(DOCS, { recursive: true, encoding: "utf8" })
	.filter((file) => /\.mdx?$/.test(file))
	.map((file) =>
		file
			.replace(/\.mdx?$/, "")
			.split(path.sep)
			.join("/"),
	);

const titleOf = (page: string) => {
	const file = fs.existsSync(path.join(DOCS, `${page}.md`)) ? `${page}.md` : `${page}.mdx`;
	return /^title:\s*(.+)$/m.exec(fs.readFileSync(path.join(DOCS, file), "utf8"))?.[1]?.trim() ?? "";
};

test("there are pages", () => {
	assert.ok(pages.length >= 5, `found ${pages.length}`);
});

test("each page has a Markdown copy, with its title and no frontmatter", () => {
	for (const page of pages) {
		const file = path.join(DIST, `${page}.md`);
		assert.ok(fs.existsSync(file), `${page}.md is missing`);
		const markdown = fs.readFileSync(file, "utf8");
		assert.ok(markdown.startsWith(`# ${titleOf(page)}\n`), `${page}.md starts with its title`);
		assert.doesNotMatch(markdown, /^---$/m, `${page}.md has no frontmatter`);
	}
});

test("llms.txt names the project and links every page's Markdown", () => {
	const llms = fs.readFileSync(path.join(DIST, "llms.txt"), "utf8");
	assert.match(llms, /^# Baseplate\n\n> /);
	for (const page of pages) {
		assert.ok(llms.includes(`(/${page}.md)`), `llms.txt links ${page}.md`);
	}
});

test("each page is built as HTML", () => {
	for (const page of pages) {
		const html = page === "index" ? "index.html" : `${page}/index.html`;
		assert.ok(fs.existsSync(path.join(DIST, html)), `${html} is missing`);
	}
});
