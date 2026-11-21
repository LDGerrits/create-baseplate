import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

export default defineConfig({
	integrations: [
		starlight({
			title: "Baseplate",
			description: "The agent-ready way to start a roblox-ts game.",
			sidebar: [
				{ label: "Start here", items: ["getting-started", "cli", "add-ons"] },
				{ label: "Working with agents", items: ["agents"] },
				{ label: "The game", items: ["project", "testing", "ui", "world-and-studio", "roblox-ts"] },
			],
			// Agents read the same pages as Markdown: /llms.txt lists them.
			head: [{ tag: "link", attrs: { rel: "alternate", type: "text/plain", href: "/llms.txt", title: "llms.txt" } }],
		}),
	],
});
