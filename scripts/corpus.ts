// The corpus: correct game code, one folder per language in cli/corpus/, laid out as in a game made
// with no add-ons. Every rule the check enforces must accept it, so a rule that fires on legitimate
// code fails CI rather than an agent's session. CI's first batch of each language copies it into a
// fresh game and runs the game's check (.github/scripts/run-games.ts); `mise run try -- --corpus`
// does the same here. The skills' code examples are kept in it too (cli/test/corpus.test.ts).
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
