// Snapshots the experience's DataStores through Open Cloud, as the publish workflow does before it
// publishes to prod. Nothing is copied: after a snapshot, the next write to each key keeps the value
// it replaces as a version, so all data as it stood stays restorable for at least 30 days. Roblox
// takes one a day, so a second run that day reports the earlier one.
//
//   node scripts/snapshot.ts
//
// Reads ROBLOX_PUBLISH_API_KEY (a key with universe-datastores.control:snapshot on the experience)
// and ROBLOX_PUBLISH_UNIVERSE_ID.
async function snapshot() {
	const key = process.env.ROBLOX_PUBLISH_API_KEY ?? "";
	const universe = process.env.ROBLOX_PUBLISH_UNIVERSE_ID ?? "";
	if (key === "" || universe === "") {
		throw new Error("Set ROBLOX_PUBLISH_API_KEY and ROBLOX_PUBLISH_UNIVERSE_ID (in .env, or CI's environment).");
	}
	const response = await fetch(`https://apis.roblox.com/cloud/v2/universes/${universe}/data-stores:snapshot`, {
		method: "POST",
		headers: { "x-api-key": key, "content-type": "application/json" },
		body: "{}",
	});
	const body = await response.text();
	if (!response.ok) {
		throw new Error(
			`Open Cloud refused the snapshot (${response.status}): ${body}\nThe key needs universe-datastores.control:snapshot on experience ${universe}.`,
		);
	}
	const { newSnapshotTaken, latestSnapshotTime } = JSON.parse(body) as {
		newSnapshotTaken?: boolean;
		latestSnapshotTime?: string;
	};
	console.log(
		newSnapshotTaken === true
			? `Snapshotted the DataStores of experience ${universe}.`
			: `The DataStores of experience ${universe} were already snapshotted today, at ${latestSnapshotTime}.`,
	);
}

if (import.meta.main) {
	await snapshot().catch((error: unknown) => {
		console.error(error instanceof Error ? error.message : error);
		process.exit(1);
	});
}
