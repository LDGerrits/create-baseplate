import fs from "node:fs";
import path from "node:path";
import { NAMED_FILES, TEMPLATE_NAME } from "../consts.ts";

/** Replaces the template's name with the project's in the files that hold it. */
export function setProjectName(dir: string, name: string) {
	for (const file of NAMED_FILES) {
		const at = path.join(dir, file);
		if (!fs.existsSync(at)) continue;
		fs.writeFileSync(at, fs.readFileSync(at, "utf8").replaceAll(TEMPLATE_NAME, name));
	}
}
