/** The first question, a fork in the road: each language has its own template and questions. */
export const languages = [
	{ value: "luau", label: "Luau", hint: "Rojo, Wally, StyLua, Selene and luau-lsp" },
	{ value: "typescript", label: "TypeScript", hint: "roblox-ts, with Flamework" },
] as const;

export type Language = (typeof languages)[number]["value"];

export const DEFAULT_LANGUAGE: Language = "luau";

export const isLanguage = (value: string): value is Language => languages.some((language) => language.value === value);

const LANGUAGE_NAMES: Record<Language, string> = { typescript: "TypeScript", luau: "Luau" };
export const languageName = (language: Language) => LANGUAGE_NAMES[language];
