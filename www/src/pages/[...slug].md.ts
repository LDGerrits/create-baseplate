// Every docs page as plain Markdown at /<page>.md, for agents: its title, a splash page's tagline,
// then its source without frontmatter. Links to other pages point at their Markdown copies.

import { type CollectionEntry, getCollection } from "astro:content";
import type { APIRoute, GetStaticPaths } from "astro";

export const getStaticPaths = (async () =>
	(await getCollection("docs")).map((entry) => ({
		params: { slug: entry.id },
		props: { entry },
	}))) satisfies GetStaticPaths;

// `](/cli/)` and `](/cli/#flags)` become `](/cli.md)` and `](/cli.md#flags)`.
const toMarkdownLinks = (body: string) => body.replace(/\]\(\/([\w/-]+?)\/(#[^)]*)?\)/g, "](/$1.md$2)");

export const GET: APIRoute<{ entry: CollectionEntry<"docs"> }> = ({ props: { entry } }) => {
	const parts = [`# ${entry.data.title}`, entry.data.hero?.tagline, toMarkdownLinks((entry.body ?? "").trim())];
	return new Response(`${parts.filter((part) => part !== undefined && part !== "").join("\n\n")}\n`);
};
