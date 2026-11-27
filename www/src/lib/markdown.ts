import { type CollectionEntry, getEntry } from "astro:content";
import { SIDEBAR } from "../sidebar.ts";

const toMarkdownLinks = (body: string) => body.replace(/\]\(\/([\w/-]+?)\/(#[^)]*)?\)/g, "](/$1.md$2)");

export function markdownOf(entry: CollectionEntry<"docs">): string {
	const parts = [`# ${entry.data.title}`, entry.data.hero?.tagline, toMarkdownLinks((entry.body ?? "").trim())];
	return `${parts.filter((part) => part !== undefined && part !== "").join("\n\n")}\n`;
}

/** Every page, the home page first, then in the sidebar's order. */
export async function pagesInOrder(): Promise<CollectionEntry<"docs">[]> {
	const order = ["index", ...SIDEBAR.flatMap((group) => group.items)];
	const pages = await Promise.all(order.map((id) => getEntry("docs", id)));
	return pages.filter((page) => page !== undefined);
}
