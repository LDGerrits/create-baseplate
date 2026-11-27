import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

const SRC = path.join(import.meta.dirname, "..", "src");
const LAYERS = ["base", "domain", "commands"];
const rank = (file: string) => {
	const top = path.relative(SRC, file).split(path.sep)[0] ?? "";
	return top === "main.ts" ? LAYERS.length : LAYERS.indexOf(top);
};

test("src's layers import only the layers below them", () => {
	const problems: string[] = [];
	for (const entry of fs.readdirSync(SRC, { recursive: true, encoding: "utf8" })) {
		if (!entry.endsWith(".ts")) continue;
		const file = path.join(SRC, entry);
		assert.notEqual(rank(file), -1, `${entry} is outside the layers: ${LAYERS.join(", ")} or main.ts`);
		for (const [, spec] of fs.readFileSync(file, "utf8").matchAll(/from "(\.{1,2}\/[^"]+)"/g)) {
			const target = path.resolve(path.dirname(file), spec ?? "");
			const sameModule = path.dirname(path.relative(SRC, target)) === path.dirname(entry);
			const allowed = rank(target) < rank(file) || (rank(target) === rank(file) && (rank(file) !== 2 || sameModule));
			if (!allowed) problems.push(`${entry} imports ${path.relative(SRC, target)}`);
		}
	}
	assert.deepEqual(problems, [], `Import only from a lower layer (${LAYERS.join(" < ")} < main.ts).`);
});
