// Every docs page as plain Markdown at /<page>.md, for agents (src/lib/markdown.ts).

import { type CollectionEntry, getCollection } from "astro:content";
import type { APIRoute, GetStaticPaths } from "astro";
import { markdownOf } from "../lib/markdown.ts";

export const getStaticPaths = (async () =>
	(await getCollection("docs")).map((entry) => ({
		params: { slug: entry.id },
		props: { entry },
	}))) satisfies GetStaticPaths;

export const GET: APIRoute<{ entry: CollectionEntry<"docs"> }> = ({ props: { entry } }) =>
	new Response(markdownOf(entry));
