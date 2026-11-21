import { describe, expect, it } from "@rbxts/jest-globals";
import { world } from "@rbxts/jecs";
import { Part, Spin, spinnerSystem } from "./spinner-system";

describe("spinnerSystem", () => {
	it("turns a spinning part by its speed times the time", () => {
		const testWorld = world();
		const part = new Instance("Part");
		const entity = testWorld.entity();
		testWorld.set(entity, Part, part);
		testWorld.set(entity, Spin, math.pi);

		spinnerSystem(testWorld, 0.5);

		// A quarter turn about the up axis: looking along -Z becomes looking along -X.
		expect(part.CFrame.LookVector.X).toBeCloseTo(-1);
	});

	it("leaves a part without a speed alone", () => {
		const testWorld = world();
		const part = new Instance("Part");
		testWorld.set(testWorld.entity(), Part, part);

		spinnerSystem(testWorld, 1);

		expect(part.CFrame.LookVector.Z).toBeCloseTo(-1);
	});
});
