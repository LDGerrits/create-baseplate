import type { Language } from "../add-ons/language.ts";
import type { AddOnChoices } from "../add-ons/questions.ts";
import { makeMultiPlaceLuau } from "./multi-place-luau.ts";
import { makeMultiPlaceTypeScript } from "./multi-place-typescript.ts";

/**
 * Turns the single-place game in `dir`, with these add-ons, into several places: the shared code in
 * projects/common/src and each place a folder in projects/. Runs after the add-ons, so what they put
 * in src/ becomes shared code.
 */
export function makeMultiPlace(dir: string, name: string, language: Language, choices: AddOnChoices) {
	if (language === "luau") makeMultiPlaceLuau(dir, name, choices);
	else makeMultiPlaceTypeScript(dir, name, choices);
}
