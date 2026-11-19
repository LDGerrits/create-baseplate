// jest-roblox runs every spec in a real Roblox engine: `mise run test:engine`.
// It picks Roblox Studio when installed and Open Cloud otherwise; see AGENTS.md.
import { defineConfig } from "@isentinel/jest-roblox";

export default defineConfig({
	placeFile: "./build/test.rbxl",
	formatters: ["agent"],
});
