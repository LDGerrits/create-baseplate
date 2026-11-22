import { component, type World } from "@rbxts/jecs";

/** The part an entity moves. */
export const Part = component<BasePart>();
/** How fast an entity spins, in radians per second. */
export const Spin = component<number>();

/** Turns every entity that has a Part and a Spin. It uses only the world and the time, so a spec can run it on its own world. */
export function spinnerSystem(world: World, deltaTime: number) {
	for (const [, part, speed] of world.query(Part, Spin)) {
		part.CFrame = part.CFrame.mul(CFrame.Angles(0, speed * deltaTime, 0));
	}
}
