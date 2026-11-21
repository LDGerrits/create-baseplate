## Entities

Flamework Components (`@flamework/components`) attach behaviour to tagged instances: `SpinnerComponent` spins each part tagged `Spinner`. A component is a class with `@Component({ tag })`, extending `BaseComponent<Attributes, InstanceType>`; import it in `src/app/server/main.server.ts` (or the client's main), and clean up in `destroy()`. Tag instances in Studio or in a `.model.json` under `world/`, as `world/Workspace/Spinner.model.json` does; `tests/e2e/spinner.luau` checks the spinner turns.
