import fs from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const API = "https://apis.roblox.com";
/** Roblox keeps performance metrics, such as the error count, for 28 days; the details default to 7. */
const COUNT_DAYS = 7;
const HASHES_PER_REQUEST = 50;
const MAX_ERRORS = 100;

export type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

export interface ErrorsRequest {
	key: string;
	universe: string;
	place: string;
	now: Date;
	version?: number;
	hours?: number;
	pollMs?: number;
}

export interface PlaceError {
	id: string;
	count: number;
	message: string;
	stacktrace: string;
	severity: string;
	source: string;
	firstSeen: string | null;
	firstSeenVersion: number | null;
}

interface Series {
	breakdowns?: { dimension: string; value: string }[];
	dataPoints?: { value: number }[];
}
interface Operation {
	path?: string;
	done?: boolean;
	response?: { values?: Series[] };
	error?: { code?: number; message?: string };
}
interface Detail {
	id: string;
	logSeverity?: string;
	logSource?: string;
	message?: string;
	stacktrace?: string;
	firstSeenUtc?: string | null;
	firstSeenPlaceVersion?: number | null;
}

export function placeIdFor(setting: string, place: string, multi: boolean): string {
	const variable = "ROBLOX_ERRORS_PLACE_ID";
	const value = setting.trim();
	if (value === "") throw new Error(`Set ${variable} to the ID of the place.`);
	if (!value.includes("=")) {
		if (multi) throw new Error(`Each place needs its ID: set ${variable} to ${place}=<id>,...`);
		if (!/^\d+$/.test(value)) throw new Error(`${variable} is not a place ID: ${value}`);
		return value;
	}
	const id = value
		.split(",")
		.map((pair) => pair.split("=").map((part) => part.trim()))
		.find(([name]) => name === place)?.[1];
	if (id === undefined) throw new Error(`${variable} has no ID for the place "${place}".`);
	if (!/^\d+$/.test(id)) throw new Error(`${variable}'s ID for "${place}" is not a number: ${id}`);
	return id;
}

export function parseErrorsArgs(args: string[]): { version?: number; hours?: number; json?: boolean } {
	const result: { version?: number; hours?: number; json?: boolean } = {};
	const number = (name: string, value: string | undefined) => {
		if (value === undefined || !/^\d+(\.\d+)?$/.test(value))
			throw new Error(`${name} takes a number, not ${value ?? "nothing"}.`);
		return Number(value);
	};
	for (let index = 0; index < args.length; index++) {
		const arg = args[index] ?? "";
		if (arg === "--json") result.json = true;
		else if (arg === "--version") result.version = number(arg, args[++index]);
		else if (arg === "--hours") result.hours = number(arg, args[++index]);
		else if (/^\d+$/.test(arg)) result.version = Number(arg);
		else throw new Error(`Unknown option ${arg}: give a place version, --hours <n> or --json.`);
	}
	if (result.version === undefined && result.hours === undefined) result.hours = 24;
	return result;
}

function explain(status: number, body: string): Error {
	const hints: Record<number, string> = {
		401: "ROBLOX_ERRORS_API_KEY was refused: check the key is right and not expired.",
		403: "The key can't read this experience's errors: it needs universe.analytics:read (and the experience under Access Permissions), and its owner needs analytics access to the experience.",
		429: "Open Cloud allows 60 requests a minute per key for this API: wait a minute and run it again.",
	};
	return new Error(hints[status] ?? `Open Cloud answered ${status}: ${body.slice(0, 300)}`);
}

async function json<T>(response: Response): Promise<T> {
	const text = await response.text();
	if (!response.ok) throw explain(response.status, text);
	return JSON.parse(text) as T;
}

async function countErrors(request: ErrorsRequest, fetch: Fetch): Promise<Map<string, number>> {
	const headers = { "x-api-key": request.key };
	let operation = await json<Operation>(
		await fetch(`${API}/analytics-query-api/v1/universes/${request.universe}/metrics`, {
			method: "POST",
			headers: { ...headers, "content-type": "application/json" },
			body: JSON.stringify({
				metric: "ErrorCount",
				granularity: "None",
				breakdown: ["MessageHash"],
				startTime: new Date(request.now.getTime() - COUNT_DAYS * 86_400_000).toISOString(),
				endTime: request.now.toISOString(),
				limit: MAX_ERRORS,
			}),
		}),
	);
	for (let tries = 0; operation.done !== true; tries++) {
		if (tries >= 60 || operation.path === undefined) throw new Error("The error count query didn't finish.");
		await sleep(request.pollMs ?? 2000);
		operation = await json<Operation>(await fetch(`${API}/analytics-query-api/${operation.path}`, { headers }));
	}
	if (operation.error !== undefined) {
		throw new Error(`The error count query failed (${operation.error.code}): ${operation.error.message}`);
	}
	const counts = new Map<string, number>();
	for (const series of operation.response?.values ?? []) {
		const hash = series.breakdowns?.find((one) => one.dimension === "MessageHash")?.value;
		if (hash !== undefined) counts.set(hash, series.dataPoints?.reduce((sum, point) => sum + point.value, 0) ?? 0);
	}
	return counts;
}

export async function readErrors(request: ErrorsRequest, fetch: Fetch = globalThis.fetch): Promise<PlaceError[]> {
	const counts = await countErrors(request, fetch);
	const hashes = [...counts.keys()];
	const details: Detail[] = [];
	for (let at = 0; at < hashes.length; at += HASHES_PER_REQUEST) {
		const query = new URLSearchParams();
		for (const hash of hashes.slice(at, at + HASHES_PER_REQUEST)) query.append("messageHashIds", hash);
		query.set("startTime", new Date(request.now.getTime() - COUNT_DAYS * 86_400_000).toISOString());
		query.set("endTime", request.now.toISOString());
		query.set("placeId", request.place);
		if (request.version !== undefined) query.set("firstSeenPlaceVersion", String(request.version));
		const reply = await json<{ values?: Detail[] }>(
			await fetch(
				`${API}/universe-performance-raqi/v1/events/logging/universe/${request.universe}/log-details?${query}`,
				{
					headers: { "x-api-key": request.key },
				},
			),
		);
		details.push(...(reply.values ?? []));
	}
	const since = request.version === undefined ? request.now.getTime() - (request.hours ?? 24) * 3_600_000 : undefined;
	return details
		.map((detail) => ({
			id: detail.id,
			count: counts.get(detail.id) ?? 0,
			message: detail.message ?? "",
			stacktrace: detail.stacktrace ?? "",
			severity: detail.logSeverity ?? "Error",
			source: detail.logSource ?? "",
			firstSeen: detail.firstSeenUtc ?? null,
			firstSeenVersion: detail.firstSeenPlaceVersion ?? null,
		}))
		.filter((error) => since === undefined || (error.firstSeen !== null && Date.parse(error.firstSeen) >= since))
		.sort((a, b) => b.count - a.count);
}

export function formatErrors(errors: PlaceError[], when: string): string {
	if (errors.length === 0) return `No errors first seen ${when}.`;
	const lines = [
		`${errors.length} error${errors.length === 1 ? "" : "s"} first seen ${when}, the most frequent first:`,
		"",
	];
	for (const error of errors) {
		const version = error.firstSeenVersion === null ? "" : `, version ${error.firstSeenVersion}`;
		lines.push(
			`${String(error.count).padStart(5)}x  ${error.source} ${error.severity}  (first seen ${error.firstSeen ?? "at an unknown time"}${version})`,
		);
		lines.push(`       ${error.message}`);
		for (const line of error.stacktrace.split("\n")) if (line.trim() !== "") lines.push(`         ${line}`);
		lines.push("");
	}
	return lines.join("\n").trimEnd();
}

if (import.meta.main) {
	try {
		const { json: asJson, ...window } = parseErrorsArgs(process.argv.slice(2));
		const key = process.env.ROBLOX_ERRORS_API_KEY ?? "";
		const universe = process.env.ROBLOX_ERRORS_UNIVERSE_ID ?? "";
		if (key === "" || universe === "") {
			throw new Error("Set ROBLOX_ERRORS_API_KEY and ROBLOX_ERRORS_UNIVERSE_ID (in .env; see .env.example).");
		}
		const place = placeIdFor(
			process.env.ROBLOX_ERRORS_PLACE_ID ?? "",
			process.env.PLACE ?? "",
			fs.existsSync(path.join(process.env.ROOT ?? process.cwd(), "projects")),
		);
		const errors = await readErrors({ key, universe, place, now: new Date(), ...window });
		const when =
			window.version === undefined
				? `in the last ${window.hours} hours`
				: `in place version ${window.version} or later`;
		console.log(asJson === true ? JSON.stringify(errors, null, 2) : formatErrors(errors, when));
	} catch (error) {
		console.error(error instanceof Error ? error.message : error);
		process.exit(1);
	}
}
