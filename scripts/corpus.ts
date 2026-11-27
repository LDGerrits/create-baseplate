import fs from "node:fs";
import path from "node:path";

export const CORPUS_DIR = path.resolve(import.meta.dirname, "..", "cli", "corpus");

export type Language = "typescript" | "luau";

/** The flags that make the game a corpus goes into. */
export const corpusFlags = (language: Language) => ["--language", language];

/** Copies the language's corpus over the game in `dir`, replacing the files it has. */
export function applyCorpus(dir: string, language: Language) {
	fs.cpSync(path.join(CORPUS_DIR, language), dir, { recursive: true });
}
