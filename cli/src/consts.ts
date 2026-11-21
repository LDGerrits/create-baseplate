import path from "node:path";
import { fileURLToPath } from "node:url";

// The build puts the template beside the bundle: dist/index.js and dist/template/.
const DIST = path.dirname(fileURLToPath(import.meta.url));
export const TEMPLATE_BASE = path.join(DIST, "template", "base");
export const TEMPLATE_EXTRAS = path.join(DIST, "template", "extras");
// Written by scripts/copyTemplate.ts: symbolic links, which npm doesn't pack, to recreate.
export const SYMLINKS_FILE = "_symlinks.json";

// The template's own name, which a new project replaces with its name.
export const TEMPLATE_NAME = "my-game";
export const DEFAULT_APP_NAME = "my-game";
// Files that hold the template's name.
export const NAMED_FILES = [
	"package.json",
	"default.rogen.json",
	"src/app/client/ui.storybook.ts",
	"AGENTS.md",
	"README.md",
	".gitignore",
];
