import { defineConfig } from "@isentinel/jest-roblox";

export default defineConfig({
	placeFile: "./build/test.rbxl",
	// The whole game as the tests in ree see it, with the loadstring() Jest needs.
	rojoProject: "test.project.json",
	formatters: ["agent"],
});
