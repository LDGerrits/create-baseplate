import { defineConfig } from "tsup";

export default defineConfig({
	entry: { index: "src/main.ts" },
	format: ["esm"],
	target: "node22",
	clean: true,
});
