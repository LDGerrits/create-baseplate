import { component, type World } from "@rbxts/jecs";

export const Part = component<BasePart>();
export const Spin = component<number>();

export function spinnerSystem(world: World, deltaTime: number) {
	for (const [, part, radiansPerSecond] of world.query(Part, Spin)) {
		part.CFrame = part.CFrame.mul(CFrame.Angles(0, radiansPerSecond * deltaTime, 0));
	}
}
