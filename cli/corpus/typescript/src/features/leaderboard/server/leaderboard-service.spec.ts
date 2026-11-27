import { describe, expect, it } from "@rbxts/jest-globals";
import { topScores } from "./leaderboard-service";

describe("topScores", () => {
	it("keeps the highest scores, highest first", () => {
		const top = topScores(
			[
				{ key: "a", value: 1 },
				{ key: "b", value: 3 },
				{ key: "c", value: 2 },
			],
			2,
		);
		expect(top.map((entry) => entry.key)).toEqual(["b", "c"]);
	});
});
