import path from "node:path";
import { fileURLToPath } from "node:url";

// The build puts the template and the docs beside the bundle: dist/index.js, dist/template/<language>/
// and dist/docs/.
const DIST = path.dirname(fileURLToPath(import.meta.url));
/** The game a language's projects start from. */
export const templateBase = (language: string) => path.join(DIST, "template", language, "base");
/** A language's add-ons, one folder per question and choice. */
export const templateExtras = (language: string) => path.join(DIST, "template", language, "extras");
/** The docs site's pages, which `create-baseplate doc` prints (scripts/copyDocs.ts writes them). */
export const DOCS_DIR = path.join(DIST, "docs");
// Written by scripts/copyTemplate.ts: symbolic links, which npm doesn't pack, to recreate.
export const SYMLINKS_FILE = "_symlinks.json";

// The template's own name, which a new project replaces with its name.
export const TEMPLATE_NAME = "my-game";
export const DEFAULT_APP_NAME = "my-game";
// Files that hold the template's name, in either language's template.
export const NAMED_FILES = [
	"package.json",
	"default.rogen.json",
	"src/app/client/ui.storybook.ts",
	"src/app/client/Game.storybook.luau",
	"AGENTS.md",
	"README.md",
	".gitignore",
];
