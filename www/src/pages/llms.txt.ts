// /llms.txt (https://llmstxt.org): what Baseplate is, and a link to each page's Markdown copy,
// in the sidebar's reading order.

import { getEntry } from "astro:content";
import type { APIRoute } from "astro";
import { SIDEBAR } from "../sidebar.ts";

export const GET: APIRoute = async () => {
	const order = ["index", ...SIDEBAR.flatMap((group) => group.items)];
	const pages = await Promise.all(order.map((id) => getEntry("docs", id)));
	const lines = [
		"# Baseplate",
		"",
		"> Baseplate creates roblox-ts Roblox games set up for coding agents: `pnpm create baseplate <name> --json` creates, installs and commits a game; inside it, `mise run check` checks everything, and AGENTS.md explains the project.",
		"",
		"## Docs",
		"",
		...pages.flatMap((page) =>
			page === undefined
				? []
				: [`- [${page.data.title}](/${page.id}.md)${page.data.description ? `: ${page.data.description}` : ""}`],
		),
		"",
	];
	return new Response(lines.join("\n"));
};
