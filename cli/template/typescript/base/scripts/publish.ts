import fs from "node:fs";
import path from "node:path";

export function placeIdFor(setting: string, place: string, multi: boolean): string {
	const value = setting.trim();
	if (value === "") throw new Error("Set ROBLOX_PUBLISH_PLACE_ID to the ID of the place to publish to.");
	if (!value.includes("=")) {
		if (multi) throw new Error(`Each place needs its ID: set ROBLOX_PUBLISH_PLACE_ID to ${place}=<id>,...`);
		if (!/^\d+$/.test(value)) throw new Error(`ROBLOX_PUBLISH_PLACE_ID is not a place ID: ${value}`);
		return value;
	}
	const pairs = value.split(",").map((pair) => pair.split("=").map((part) => part.trim()));
	const id = pairs.find(([name]) => name === place)?.[1];
	if (id === undefined) throw new Error(`ROBLOX_PUBLISH_PLACE_ID has no ID for the place "${place}".`);
	if (!/^\d+$/.test(id)) throw new Error(`ROBLOX_PUBLISH_PLACE_ID's ID for "${place}" is not a number: ${id}`);
	return id;
}

async function publish(file: string) {
	const key = process.env.ROBLOX_PUBLISH_API_KEY ?? "";
	const universe = process.env.ROBLOX_PUBLISH_UNIVERSE_ID ?? "";
	if (key === "" || universe === "") {
		throw new Error("Set ROBLOX_PUBLISH_API_KEY and ROBLOX_PUBLISH_UNIVERSE_ID (in .env, or CI's environment).");
	}
	const place = placeIdFor(
		process.env.ROBLOX_PUBLISH_PLACE_ID ?? "",
		process.env.PLACE ?? "",
		fs.existsSync(path.join(process.env.ROOT ?? process.cwd(), "projects")),
	);
	const response = await fetch(
		`https://apis.roblox.com/universes/v1/${universe}/places/${place}/versions?versionType=Published`,
		{
			method: "POST",
			headers: { "x-api-key": key, "content-type": "application/octet-stream" },
			body: fs.readFileSync(file),
		},
	);
	const body = await response.text();
	if (!response.ok) throw new Error(`Open Cloud refused ${file} (${response.status}): ${body}`);
	const { versionNumber } = JSON.parse(body) as { versionNumber: number };
	console.log(`Published ${file} to place ${place} as version ${versionNumber}.`);
}

if (import.meta.main) {
	const [file] = process.argv.slice(2);
	if (file === undefined) {
		console.error("Usage: node scripts/publish.ts <place file>");
		process.exit(1);
	}
	await publish(file).catch((error: unknown) => {
		console.error(error instanceof Error ? error.message : error);
		process.exit(1);
	});
}
