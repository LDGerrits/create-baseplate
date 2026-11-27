import fs from "node:fs";
import path from "node:path";
import { templateExtras } from "../../base/template.ts";
import { replaceExact, replaceSection } from "../../base/text-edit.ts";
import type { Language } from "../add-ons/language.ts";
import type { Managed } from "../add-ons/questions.ts";

/** The places a multi-place game starts with. */
export const PLACES = ["lobby", "game"];
/**
 * The place that runs the shared code's tests. Each place compiles the shared code, so its specs
 * and end-to-end tests would otherwise run once per place, for the same result.
 */
export const SHARED_TESTS_PLACE = "game";

/** A file of the language's places add-on; the sections that name the world have a partial variant. */
export const placesExtra = (language: Language, managed: Managed, file: string) =>
	fs.readFileSync(
		path.join(
			templateExtras(language),
			"places",
			"multi",
			managed === "full" ? file : file.replace(/\.md$/, ".partial.md"),
		),
		"utf8",
	);

/** The template's end-to-end tests are the shared features'; the other places start with none. */
export function copyPlaceTests(dir: string, placeDir: string, place: string) {
	if (place === SHARED_TESTS_PLACE) {
		fs.cpSync(path.join(dir, "tests"), path.join(placeDir, "tests"), { recursive: true });
	} else {
		fs.mkdirSync(path.join(placeDir, "tests", "e2e"), { recursive: true });
		fs.writeFileSync(path.join(placeDir, "tests", "e2e", ".gitkeep"), "");
	}
}

/** The README's layout section, and its commands that now name a place. */
export function multiPlaceReadme(readme: string, layout: string, managed: Managed) {
	const replaceIn = (text: string, from: string, to: string) => replaceExact(text, from, to, "places: README.md");
	let text = replaceSection(readme, "Layout", layout, "places: README.md");
	text = replaceIn(text, "mise run dev       #", "mise run dev lobby #");
	if (managed === "full") {
		text = replaceIn(text, "mise run sync      #", "mise run sync lobby #");
		text = replaceIn(
			text,
			"`mise run build`, open `build/game.rbxl` in Studio",
			"`mise run build`, open a place's `projects/<place>/build/game.rbxl` in Studio",
		);
	}
	return text;
}

/** Skills describe one place: a note under each one's title says how their paths map. */
export function addSkillNotes(dir: string, note: string) {
	for (const skill of fs.readdirSync(path.join(dir, ".agents", "skills"))) {
		const file = path.join(dir, ".agents", "skills", skill, "SKILL.md");
		const text = fs.readFileSync(file, "utf8");
		fs.writeFileSync(file, text.replace(/^(# .+\n)/m, `$1\n${note}\n`));
	}
}
