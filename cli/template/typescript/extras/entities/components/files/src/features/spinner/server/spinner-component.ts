import { BaseComponent, Component } from "@flamework/components";
import type { OnStart } from "@flamework/core";
import { RunService } from "@rbxts/services";

export const SPIN_RADIANS_PER_SECOND = math.pi / 2;

@Component({ tag: "Spinner" })
export class SpinnerComponent extends BaseComponent<object, BasePart> implements OnStart {
	private connection?: RBXScriptConnection;

	onStart() {
		this.connection = RunService.Heartbeat.Connect((deltaTime) => {
			this.instance.CFrame = this.instance.CFrame.mul(CFrame.Angles(0, SPIN_RADIANS_PER_SECOND * deltaTime, 0));
		});
	}

	override destroy() {
		this.connection?.Disconnect();
		super.destroy();
	}
}
