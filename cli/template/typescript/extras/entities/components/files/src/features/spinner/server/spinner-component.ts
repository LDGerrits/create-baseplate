import { BaseComponent, Component } from "@flamework/components";
import type { OnStart } from "@flamework/core";
import { RunService } from "@rbxts/services";

/** How fast spinners turn, in radians per second. */
export const SPIN_SPEED = math.pi / 2;

/**
 * Spins each part tagged `Spinner` in place. Flamework makes one component per tagged instance
 * (tag a part in Studio), and destroys it when the tag goes.
 */
@Component({ tag: "Spinner" })
export class SpinnerComponent extends BaseComponent<object, BasePart> implements OnStart {
	private connection?: RBXScriptConnection;

	onStart() {
		this.connection = RunService.Heartbeat.Connect((deltaTime) => {
			this.instance.CFrame = this.instance.CFrame.mul(CFrame.Angles(0, SPIN_SPEED * deltaTime, 0));
		});
	}

	override destroy() {
		this.connection?.Disconnect();
		super.destroy();
	}
}
