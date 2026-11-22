// Every add-on question's flag and choice is documented where people and agents look for them.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { addOns, valuesOf } from "../src/installers/index.ts";

const ROOT = path.resolve(import.meta.dirname, "../..");
const DOCS = ["www/src/content/docs/cli.md", "www/src/content/docs/add-ons.md", "cli/README.md", "README.md"];

for (const doc of DOCS) {
	test(`${doc} names every add-on flag and choice`, () => {
		const text = fs.readFileSync(path.join(ROOT, doc), "utf8");
		const missing = addOns.flatMap((addOn) => [
			...(text.includes(`--${addOn.name}`) ? [] : [`--${addOn.name}`]),
			...valuesOf(addOn)
				.filter((value) => !text.includes(`\`${value}\``))
				.map((value) => `--${addOn.name} ${value}`),
		]);
		assert.deepEqual(missing, []);
	});
}
