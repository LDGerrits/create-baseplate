// /llms.txt (https://llmstxt.org): what Baseplate is, and a link to each page's Markdown copy.

import { getCollection } from "astro:content";
import type { APIRoute } from "astro";

export const GET: APIRoute = async () => {
	const pages = (await getCollection("docs")).sort((a, b) => (a.id === "index" ? -1 : a.id.localeCompare(b.id)));
	const lines = [
		"# Baseplate",
		"",
		"> Baseplate creates roblox-ts Roblox games set up for coding agents: `pnpm create baseplate <name> --yes` creates, installs and commits a game; inside it, `mise run check` checks everything, and AGENTS.md explains the project.",
		"",
		"## Docs",
		"",
		...pages.map(
			(page) => `- [${page.data.title}](/${page.id}.md)${page.data.description ? `: ${page.data.description}` : ""}`,
		),
		"",
	];
	return new Response(lines.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
