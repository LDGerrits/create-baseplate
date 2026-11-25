import { type OnStart, Service } from "@flamework/core";
import { type Entity, world } from "@rbxts/jecs";
import { CollectionService, RunService } from "@rbxts/services";
import { Part, Spin, spinnerSystem } from "./spinner-system";

/** How fast spinners turn, in radians per second. */
export const SPIN_SPEED = math.pi / 2;

/**
 * Keeps a Jecs world of the parts tagged `Spinner` (tag a part in Studio) and runs the spinner system on it each frame.
 */
@Service()
export class SpinnerService implements OnStart {
	private readonly world = world();
	private readonly entities = new Map<Instance, Entity>();

	onStart() {
		for (const instance of CollectionService.GetTagged("Spinner")) this.add(instance);
		CollectionService.GetInstanceAddedSignal("Spinner").Connect((instance) => {
			this.add(instance);
		});
		CollectionService.GetInstanceRemovedSignal("Spinner").Connect((instance) => {
			const entity = this.entities.get(instance);
			if (entity !== undefined) this.world.delete(entity);
			this.entities.delete(instance);
		});
		RunService.Heartbeat.Connect((deltaTime) => {
			spinnerSystem(this.world, deltaTime);
		});
	}

	private add(instance: Instance) {
		if (!instance.IsA("BasePart")) return;
		const entity = this.world.entity();
		this.world.set(entity, Part, instance);
		this.world.set(entity, Spin, SPIN_SPEED);
		this.entities.set(instance, entity);
	}
}
