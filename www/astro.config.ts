import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import { SIDEBAR } from "./src/sidebar.ts";

export default defineConfig({
	integrations: [
		starlight({
			title: "Baseplate",
			description: "The agent-ready way to start a roblox-ts game.",
			sidebar: SIDEBAR.map((group) => ({ label: group.label, items: [...group.items] })),
			// Agents read the same pages as Markdown: /llms.txt lists them.
			head: [{ tag: "link", attrs: { rel: "alternate", type: "text/plain", href: "/llms.txt", title: "llms.txt" } }],
		}),
	],
});
