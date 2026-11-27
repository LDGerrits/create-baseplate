// no-spec: it only feeds tagged parts to the spinner system, whose spec and end-to-end test cover it
import { type OnStart, Service } from "@flamework/core";
import { type Entity, world } from "@rbxts/jecs";
import { CollectionService, RunService } from "@rbxts/services";
import { Part, Spin, spinnerSystem } from "./spinner-system";

export const SPIN_RADIANS_PER_SECOND = math.pi / 2;

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
		this.world.set(entity, Spin, SPIN_RADIANS_PER_SECOND);
		this.entities.set(instance, entity);
	}
}
