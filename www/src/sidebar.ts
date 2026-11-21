// The docs' reading order: the sidebar shows it, and llms.txt lists the pages in it.
// A test checks that every page is here.
export const SIDEBAR = [
	{ label: "Start here", items: ["getting-started", "cli", "add-ons"] },
	{ label: "Working with agents", items: ["agents"] },
	{ label: "The game", items: ["project", "testing", "ui", "world-and-studio", "roblox-ts"] },
] as const satisfies readonly { label: string; items: readonly string[] }[];
