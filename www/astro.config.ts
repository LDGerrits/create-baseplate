import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import { SIDEBAR } from "./src/sidebar.ts";
import { REPOSITORY, SITE_URL } from "./src/site.ts";

export default defineConfig({
	...(SITE_URL === undefined ? {} : { site: SITE_URL }),
	integrations: [
		starlight({
			title: "Create Baseplate",
			description: "The agent-ready way to start a Roblox game, in roblox-ts or Luau.",
			social: [{ icon: "github", label: "GitHub", href: REPOSITORY }],
			editLink: { baseUrl: `${REPOSITORY}/edit/main/www/` },
			sidebar: SIDEBAR.map((group) => ({ label: group.label, items: [...group.items] })),
			// Agents read the same pages as Markdown: /llms.txt lists them, /llms-full.txt holds them all.
			head: [{ tag: "link", attrs: { rel: "alternate", type: "text/plain", href: "/llms.txt", title: "llms.txt" } }],
		}),
	],
});
