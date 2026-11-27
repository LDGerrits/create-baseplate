// Every language and add-on question's flag and choice is documented where people and agents look for them.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { languages } from "../src/domain/add-ons/language.ts";
import { allAddOns, flagValuesOf } from "../src/domain/add-ons/questions.ts";

const ROOT = path.resolve(import.meta.dirname, "../..");
const DOCS = ["www/src/content/docs/cli.md", "www/src/content/docs/add-ons.md", "cli/README.md", "README.md"];

for (const doc of DOCS) {
	test(`${doc} names every language, add-on flag and choice`, () => {
		const text = fs.readFileSync(path.join(ROOT, doc), "utf8");
		const missing = [
			...(text.includes("--language") ? [] : ["--language"]),
			...languages
				.filter((language) => !text.includes(`\`${language.value}\``))
				.map((language) => `--language ${language.value}`),
			...allAddOns.flatMap((addOn) => [
				...(text.includes(`--${addOn.name}`) ? [] : [`--${addOn.name}`]),
				...flagValuesOf(addOn.name)
					.filter((value) => !text.includes(`\`${value}\``))
					.map((value) => `--${addOn.name} ${value}`),
			]),
		];
		assert.deepEqual(missing, []);
	});
}
