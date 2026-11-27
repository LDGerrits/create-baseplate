import assert from "node:assert/strict";
import { test } from "node:test";
import { generatedWrites } from "./written.ts";

test("a shell edit of a generated file is reported, a generator's write isn't", () => {
	assert.equal(generatedWrites("sed -i 's/a/b/' default.project.json", ["default.project.json"]).length, 1);
	assert.match(
		generatedWrites("sed -i 's/a/b/' default.project.json", ["default.project.json"])[0] ?? "",
		/is generated/,
	);
	assert.deepEqual(generatedWrites("mise run generate", ["default.project.json"]), []);
	assert.deepEqual(generatedWrites("sed -i 's/a/b/' src/a.luau", ["src/a.luau"]), []);
});
