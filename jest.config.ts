// jest-roblox runs every spec in a real Roblox engine: `mise run test:engine`.
// It picks Roblox Studio when installed and Open Cloud otherwise; see AGENTS.md.
import { defineConfig } from "@isentinel/jest-roblox";

export default defineConfig({
	placeFile: "./build/test.rbxl",
	// The whole game, code and world, as the tests in ree see it.
	rojoProject: "game.project.json",
	formatters: ["agent"],
});
