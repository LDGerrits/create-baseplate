import assert from "node:assert/strict";
import { test } from "node:test";
import { replaceExact, replaceSection } from "../src/base/text-edit.ts";

test("replaceSection replaces a section up to the next heading", () => {
	const text = "# Game\n\n## Layout\nold\nlines\n\n## Tests\nkept\n";
	assert.equal(
		replaceSection(text, "Layout", "## Layout\nnew\n", "README.md"),
		"# Game\n\n## Layout\nnew\n\n## Tests\nkept\n",
	);
});

test("replaceSection ends the file with one newline when the section is the last", () => {
	assert.equal(
		replaceSection("# Game\n\n## Layout\nold\n", "Layout", "\n## Layout\nnew\n\n", "README.md"),
		"# Game\n\n## Layout\nnew\n",
	);
});

test("replaceSection fails when the heading is gone, naming where", () => {
	assert.throws(() => replaceSection("# Game\n\n## Tests\n", "Layout", "## Layout\n", "README.md"), {
		message: 'README.md has no "## Layout" section to replace',
	});
});

test("replaceExact replaces the text, and fails when it's gone", () => {
	assert.equal(
		replaceExact('"rootDir": "src",', '"src"', '"projects/common/src"', "tsconfig.json"),
		'"rootDir": "projects/common/src",',
	);
	assert.throws(() => replaceExact("abc", "x", "y", "tsconfig.json"), {
		message: "tsconfig.json no longer has the text to replace: x",
	});
});

test("replaceExact keeps a $ in the new text as it is", () => {
	assert.equal(replaceExact("a = 1", "1", "$&$1", "x.luau"), "a = $&$1");
});
