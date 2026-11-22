// /llms.txt (https://llmstxt.org): what Baseplate is, and a link to each page's Markdown copy,
// in the sidebar's reading order: by full URL once the site's address is set (src/site.ts).

import type { APIRoute } from "astro";
import { pagesInOrder } from "../lib/markdown.ts";
import { SUMMARY } from "../site.ts";

export const GET: APIRoute = async ({ site }) => {
	const url = (path: string) => (site === undefined ? path : new URL(path, site).href);
	const pages = await pagesInOrder();
	const lines = [
		"# Baseplate",
		"",
		`> ${SUMMARY}`,
		"",
		`Every page in one file: [llms-full.txt](${url("/llms-full.txt")})`,
		"",
		"## Docs",
		"",
		...pages.map(
			(page) =>
				`- [${page.data.title}](${url(`/${page.id}.md`)})${page.data.description ? `: ${page.data.description}` : ""}`,
		),
		"",
	];
	return new Response(lines.join("\n"));
};
