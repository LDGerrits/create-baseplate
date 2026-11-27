import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIST = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE = fs.existsSync(path.join(DIST, "template"))
	? path.join(DIST, "template")
	: path.join(DIST, "..", "..", "template");
/** The game a language's projects start from. */
export const templateBase = (language: string) => path.join(TEMPLATE, language, "base");
/** A language's add-ons, one folder per question and choice. */
export const templateExtras = (language: string) => path.join(TEMPLATE, language, "extras");
/** The docs site's pages, which `create-baseplate doc` prints (scripts/copyDocs.ts writes them). */
export const DOCS_DIR = path.join(DIST, "docs");
// Written by scripts/copyTemplate.ts: symbolic links, which npm doesn't pack, to recreate.
export const SYMLINKS_FILE = "_symlinks.json";
