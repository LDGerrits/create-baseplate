import assert from "node:assert/strict";
import { test } from "node:test";
import { placeIdFor } from "./publish.ts";

test("a single-place game takes a bare ID", () => {
	assert.equal(placeIdFor(" 123 ", "my-game", false), "123");
});

test("a multi-place game takes each place's ID from its pair", () => {
	assert.equal(placeIdFor("lobby=1, game=2", "game", true), "2");
	assert.equal(placeIdFor("lobby=1,game=2", "lobby", true), "1");
});

test("a missing or malformed ID is an error, not a guess", () => {
	assert.throws(() => placeIdFor("", "my-game", false), /Set ROBLOX_PUBLISH_PLACE_ID/);
	assert.throws(() => placeIdFor("123", "lobby", true), /Each place needs its ID/);
	assert.throws(() => placeIdFor("lobby=1", "game", true), /no ID for the place "game"/);
	assert.throws(() => placeIdFor("abc", "my-game", false), /not a place ID/);
});
