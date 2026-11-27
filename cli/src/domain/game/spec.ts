import type { Language } from "../add-ons/language.ts";
import type { AddOnChoices } from "../add-ons/questions.ts";

/** What a game is made from. */
export interface GameSpec {
	name: string;
	language: Language;
	choices: AddOnChoices;
	/** The create-baseplate that makes it. */
	version: string;
}
