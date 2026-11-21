// Every docs page as plain Markdown at /<page>.md, for agents: the page's source without its
// frontmatter, under its title.

import { type CollectionEntry, getCollection } from "astro:content";
import type { APIRoute, GetStaticPaths } from "astro";

export const getStaticPaths = (async () =>
	(await getCollection("docs")).map((entry) => ({
		params: { slug: entry.id },
		props: { entry },
	}))) satisfies GetStaticPaths;

export const GET: APIRoute<{ entry: CollectionEntry<"docs"> }> = ({ props }) =>
	new Response(`# ${props.entry.data.title}\n\n${(props.entry.body ?? "").trim()}\n`, {
		headers: { "Content-Type": "text/markdown; charset=utf-8" },
	});
