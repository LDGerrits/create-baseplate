import assert from "node:assert/strict";
import { test } from "node:test";
import { type Fetch, formatErrors, parseErrorsArgs, placeIdFor, readErrors } from "./errors.ts";

const NOW = new Date("2026-11-10T12:00:00Z");
const KEY = "read-only-key";

interface Call {
	method: string;
	url: string;
	key: string | undefined;
	body: unknown;
}

function fakeApi(options: { pending?: boolean; logs?: Record<string, object>; status?: number } = {}) {
	const calls: Call[] = [];
	const counts = { "11": 40, "22": 7, "33": 3 };
	const fetch: Fetch = async (url, init) => {
		calls.push({
			method: init?.method ?? "GET",
			url,
			key: (init?.headers as Record<string, string> | undefined)?.["x-api-key"],
			body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
		});
		const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
		if (options.status !== undefined) return reply(options.status, { message: "nope" });
		if (url.endsWith("/metrics")) {
			if (options.pending === true) return reply(202, { path: "v1/universes/9/operations/metrics/op", done: false });
			return reply(200, {
				done: true,
				response: {
					values: Object.entries(counts).map(([hash, value]) => ({
						breakdowns: [{ dimension: "MessageHash", value: hash }],
						dataPoints: [{ time: "2026-11-03T12:00:00Z", value }],
					})),
				},
			});
		}
		if (url.includes("/operations/metrics/op")) {
			return reply(200, {
				done: true,
				response: {
					values: [{ breakdowns: [{ dimension: "MessageHash", value: "11" }], dataPoints: [{ time: "t", value: 40 }] }],
				},
			});
		}
		const wanted = new URL(url).searchParams.getAll("messageHashIds");
		const logs = options.logs ?? {
			"11": {
				message: "Inventory:42: attempt to index nil",
				stacktrace: "Script 'Inventory', Line 42",
				firstSeenUtc: "2026-11-09T01:00:00Z",
				firstSeenPlaceVersion: 42,
				logSeverity: "Error",
				logSource: "Server",
			},
			"33": {
				message: "Shop:9: boom",
				stacktrace: "",
				firstSeenUtc: "2026-11-09T02:00:00Z",
				firstSeenPlaceVersion: 43,
				logSeverity: "Error",
				logSource: "Client",
			},
		};
		return reply(200, { values: wanted.filter((hash) => hash in logs).map((hash) => ({ id: hash, ...logs[hash] })) });
	};
	return { fetch, calls };
}

const settings = { key: KEY, universe: "9", place: "5", now: NOW };

test("lists the errors first seen in a place version, the most frequent first, with their stack traces", async () => {
	const { fetch, calls } = fakeApi();
	const errors = await readErrors({ ...settings, version: 42 }, fetch);
	assert.deepEqual(
		errors.map((error) => [error.id, error.count, error.message]),
		[
			["11", 40, "Inventory:42: attempt to index nil"],
			["33", 3, "Shop:9: boom"],
		],
	);
	assert.equal(errors[0]?.stacktrace, "Script 'Inventory', Line 42");

	const query = calls[0];
	assert.equal(query?.method, "POST");
	assert.equal(query?.url, "https://apis.roblox.com/analytics-query-api/v1/universes/9/metrics");
	assert.deepEqual(query?.body, {
		metric: "ErrorCount",
		granularity: "None",
		breakdown: ["MessageHash"],
		startTime: "2026-11-03T12:00:00.000Z",
		endTime: "2026-11-10T12:00:00.000Z",
		limit: 100,
	});
	const details = new URL(calls[1]?.url ?? "");
	assert.equal(
		details.origin + details.pathname,
		"https://apis.roblox.com/universe-performance-raqi/v1/events/logging/universe/9/log-details",
	);
	assert.deepEqual(details.searchParams.getAll("messageHashIds"), ["11", "22", "33"]);
	assert.equal(details.searchParams.get("placeId"), "5");
	assert.equal(details.searchParams.get("firstSeenPlaceVersion"), "42");
});

test("only reads: each request is a GET of the error details or the POST of the metrics query, with the read-only key", async () => {
	const { fetch, calls } = fakeApi();
	await readErrors({ ...settings, version: 42 }, fetch);
	assert.equal(calls.length, 2);
	for (const call of calls) {
		assert.equal(call.key, KEY);
		const url = new URL(call.url);
		assert.equal(url.origin, "https://apis.roblox.com");
		const allowed =
			(call.method === "POST" && url.pathname === "/analytics-query-api/v1/universes/9/metrics") ||
			(call.method === "GET" && url.pathname === "/universe-performance-raqi/v1/events/logging/universe/9/log-details");
		assert.equal(allowed, true, `${call.method} ${url.pathname}`);
	}
});

test("without a version, keeps the errors first seen within the last hours", async () => {
	const { fetch, calls } = fakeApi({
		logs: {
			"11": {
				message: "new",
				stacktrace: "",
				firstSeenUtc: "2026-11-10T09:00:00Z",
				logSeverity: "Error",
				logSource: "Server",
			},
			"22": {
				message: "old",
				stacktrace: "",
				firstSeenUtc: "2026-11-01T09:00:00Z",
				logSeverity: "Error",
				logSource: "Server",
			},
		},
	});
	const errors = await readErrors({ ...settings, hours: 6 }, fetch);
	assert.deepEqual(
		errors.map((error) => error.message),
		["new"],
	);
	assert.equal(new URL(calls[1]?.url ?? "").searchParams.has("firstSeenPlaceVersion"), false);
});

test("follows a slow query until it is done", async () => {
	const { fetch, calls } = fakeApi({ pending: true });
	const errors = await readErrors({ ...settings, version: 42, pollMs: 0 }, fetch);
	assert.equal(calls[1]?.method, "GET");
	assert.equal(calls[1]?.url, "https://apis.roblox.com/analytics-query-api/v1/universes/9/operations/metrics/op");
	assert.deepEqual(
		errors.map((error) => error.id),
		["11"],
	);
});

test("asks for the details of many errors in several requests", async () => {
	const { fetch, calls } = fakeApi();
	const many: Fetch = async (url, init) => {
		if (url.endsWith("/metrics")) {
			calls.push({ method: "POST", url, key: KEY, body: undefined });
			const values = Array.from({ length: 120 }, (_, index) => ({
				breakdowns: [{ dimension: "MessageHash", value: String(index) }],
				dataPoints: [{ time: "t", value: 1 }],
			}));
			return new Response(JSON.stringify({ done: true, response: { values } }), { status: 200 });
		}
		return fetch(url, init);
	};
	await readErrors({ ...settings, version: 1 }, many);
	const detailCalls = calls.filter((call) => call.method === "GET");
	assert.equal(detailCalls.length, 3);
	for (const call of detailCalls) assert.ok(new URL(call.url).searchParams.getAll("messageHashIds").length <= 50);
});

test("explains a refused key, rather than showing the raw reply", async () => {
	for (const [status, hint] of [
		[401, /ROBLOX_ERRORS_API_KEY/],
		[403, /universe\.analytics:read/],
		[429, /minute/],
	] as const) {
		await assert.rejects(readErrors({ ...settings, version: 1 }, fakeApi({ status }).fetch), hint);
	}
});

test("shows each error with its count, where it was first seen and its stack trace", async () => {
	const errors = await readErrors({ ...settings, version: 42 }, fakeApi().fetch);
	const text = formatErrors(errors, "in place version 42 or later");
	assert.match(text, /2 errors first seen in place version 42 or later/);
	assert.match(text, /40x\s+Server Error/);
	assert.match(text, /Inventory:42: attempt to index nil\n\s+Script 'Inventory', Line 42/);
	assert.equal(formatErrors([], "in place version 42 or later"), "No errors first seen in place version 42 or later.");
});

test("takes a place version or a number of hours", () => {
	assert.deepEqual(parseErrorsArgs(["42"]), { version: 42 });
	assert.deepEqual(parseErrorsArgs(["--version", "7", "--json"]), { version: 7, json: true });
	assert.deepEqual(parseErrorsArgs(["--hours", "6"]), { hours: 6 });
	assert.deepEqual(parseErrorsArgs([]), { hours: 24 });
	assert.throws(() => parseErrorsArgs(["--hours", "x"]), /number/);
	assert.throws(() => parseErrorsArgs(["--publish"]), /Unknown option/);
});

test("takes the place's ID from a bare ID or its pair, and says which variable is wrong", () => {
	assert.equal(placeIdFor(" 12 ", "game", false), "12");
	assert.equal(placeIdFor("lobby=1,game=2", "game", true), "2");
	assert.throws(() => placeIdFor("", "game", false), /Set ROBLOX_ERRORS_PLACE_ID/);
	assert.throws(() => placeIdFor("12", "game", true), /Each place needs its ID/);
	assert.throws(() => placeIdFor("lobby=1", "game", true), /no ID for the place "game"/);
});
