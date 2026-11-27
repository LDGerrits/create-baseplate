import assert from "node:assert/strict";
import { test } from "node:test";
import { miseTools } from "../src/domain/add-ons/apply.ts";

test("miseTools reads the [tools] table, before another table or at the end of the file", () => {
	assert.equal(miseTools('[tools]\nnode = "24"\n\n[env]\nA = "1"\n'), 'node = "24"\n\n');
	assert.equal(miseTools('[env]\nA = "1"\n\n[tools]\nnode = "24"\n'), 'node = "24"\n');
	assert.equal(miseTools('[env]\nA = "1"\n'), undefined);
});
