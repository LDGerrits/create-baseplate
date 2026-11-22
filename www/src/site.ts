// Where the docs are published. Nothing names the domain yet: set it here once it's chosen, and
// llms.txt links to the pages by their full URL, as llmstxt.org asks, and Astro builds a sitemap
// and canonical links. Until then, links stay relative to the site.
export const SITE_URL: string | undefined = undefined;

export const REPOSITORY = "https://github.com/LDGerrits/create-baseplate";

/** What Baseplate is, atop llms.txt and llms-full.txt. */
export const SUMMARY =
	"Baseplate creates Roblox games, in roblox-ts or Luau, set up for coding agents: `pnpm create baseplate <name> --json` (add `--language luau` for Luau) creates, installs and commits a game; inside it, `mise run check` checks everything, and AGENTS.md explains the project.";
