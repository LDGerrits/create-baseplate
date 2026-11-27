import type { APIRoute } from "astro";
import { markdownOf, pagesInOrder } from "../lib/markdown.ts";
import { SUMMARY } from "../site.ts";

export const GET: APIRoute = async () => {
	const pages = await pagesInOrder();
	const parts = [`# Baseplate\n\n> ${SUMMARY}\n`, ...pages.map(markdownOf)];
	return new Response(parts.join("\n---\n\n"));
};
