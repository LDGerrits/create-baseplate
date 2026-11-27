import fs from "node:fs";
import path from "node:path";
import { NAMED_FILES, TEMPLATE_NAME } from "../../base/template.ts";

/** Replaces the template's name with the project's in the files that hold it. */
export function setProjectName(dir: string, name: string) {
	for (const file of NAMED_FILES) {
		const at = path.join(dir, file);
		if (!fs.existsSync(at)) continue;
		fs.writeFileSync(at, fs.readFileSync(at, "utf8").replaceAll(TEMPLATE_NAME, name));
	}
}

/**
 * Records in the game's package.json which create-baseplate made it, in which language and with
 * which add-ons, so a later update of the template can tell what the game started from.
 */
export function recordOrigin(dir: string, version: string, language: string, addOns: Record<string, string>) {
	const file = path.join(dir, "package.json");
	const pkg = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
	pkg.baseplate = { version, language, addOns };
	fs.writeFileSync(file, `${JSON.stringify(pkg, undefined, "\t")}\n`);
}
