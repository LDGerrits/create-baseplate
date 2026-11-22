// Copies the docs site's pages into dist/docs, for `create-baseplate doc <topic>` to print offline:
// each page as Markdown, without its frontmatter, and a list of them in the sidebar's order.
import fs from "node:fs";
import path from "node:path";
import { SIDEBAR } from "../../www/src/sidebar.ts";
import { SITE_URL } from "../../www/src/site.ts";

const SOURCE = "../www/src/content/docs";
const OUT = "dist/docs";

/** A frontmatter field on a line of its own, such as `title: Testing`. */
const field = (frontmatter: string, name: string) =>
	new RegExp(`^${name}: (.+)$`, "m")
		.exec(frontmatter)?.[1]
		?.trim()
		.replace(/^"(.*)"$/, "$1");

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const topics = SIDEBAR.flatMap((group) => group.items).map((topic) => {
	const source = fs.readFileSync(path.join(SOURCE, `${topic}.md`), "utf8");
	const match = /^---\n([\s\S]*?)\n---\n/.exec(source);
	if (match === null) throw new Error(`${topic}.md has no frontmatter`);
	const frontmatter = match[1] ?? "";
	const title = field(frontmatter, "title") ?? topic;
	const description = field(frontmatter, "description") ?? "";
	// `[the CLI](/cli/#flags)` reads as `the CLI (create-baseplate doc cli)` in a terminal.
	const body = source
		.slice(match[0].length)
		.trim()
		.replace(/\[([^\]]+)\]\(\/([\w-]+)\/(#[^)]*)?\)/g, "$1 (create-baseplate doc $2)");
	fs.writeFileSync(path.join(OUT, `${topic}.md`), `# ${title}\n\n${body}\n`);
	return { topic, title, description };
});
fs.writeFileSync(
	path.join(OUT, "topics.json"),
	`${JSON.stringify({ url: SITE_URL ?? null, topics }, undefined, "\t")}\n`,
);
console.log(`Copied ${topics.length} docs pages to ${OUT}`);
