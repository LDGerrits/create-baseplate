// The docs' reading order: the sidebar shows it, and llms.txt lists the pages in it.
// A test checks that every page is here.
export const SIDEBAR = [
	{ label: "Start here", items: ["why", "getting-started", "cli", "add-ons", "layout"] },
	{ label: "Working with agents", items: ["agents"] },
	{ label: "The game", items: ["project", "luau", "testing", "ui", "world-and-studio", "roblox-ts"] },
	{ label: "Shipping", items: ["publishing", "environment"] },
	{ label: "Help", items: ["faq", "troubleshooting"] },
] as const satisfies readonly { label: string; items: readonly string[] }[];
