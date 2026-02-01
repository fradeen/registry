import { Engine } from "json-rules-engine";
import type { Condition } from "@/registry/lib/auth/types/condition";
import type { BaseResource } from "@/registry/lib/auth/types/resource";
import type { BaseSubject } from "@/registry/lib/auth/types/subject";

type AccessControlConfig<
	S extends BaseSubject,
	Actions extends Readonly<Array<string>>,
	ResourceMap extends { [K in keyof ResourceMap]: BaseResource<K & string> },
> = {
	actions: Readonly<Array<string>>;
	getConditions: (
		subject: S,
		resource: ResourceMap[keyof ResourceMap]["type"],
		action: Actions[number],
		RequiresResource: boolean,
	) => Promise<Condition<S, ResourceMap[keyof ResourceMap], boolean>[]>;
};
type ActionMethodMap<
	Actions extends Readonly<Array<string>>,
	ResourceMap extends { [K in keyof ResourceMap]: BaseResource<K & string> },
> = {
	[A in Actions[number]]: (
		arg:
			| ResourceMap[keyof ResourceMap]
			| ResourceMap[keyof ResourceMap]["type"],
	) => Promise<boolean>;
};
export class AccessControl<
	S extends BaseSubject,
	Actions extends Readonly<Array<string>>,
	ResourceMap extends { [K in keyof ResourceMap]: BaseResource<K & string> },
> {
	#config: AccessControlConfig<S, Actions, ResourceMap>;
	#evalEngine = new Engine();
	async #checkAccess(
		subject: S,
		action: Actions[number],
		resource:
			| ResourceMap[keyof ResourceMap]
			| ResourceMap[keyof ResourceMap]["type"],
	): Promise<boolean> {
		try {
			const resourceType =
				typeof resource === "string" ? resource : resource.type;
			const conditions = await this.#config.getConditions(
				subject,
				resourceType,
				action,
				!(typeof resource === "string"),
			);
			if (!conditions.length)
				throw new Error(
					"No conditions/policies found for subject, resource/resource-type combo.",
				);
			this.#evalEngine.addFact(
				"context",
				typeof resource === "string"
					? { subject: subject }
					: {
							subject: subject,
							resource: resource,
						},
			);
			for (const condition of conditions) {
				this.#evalEngine.removeRule("rule");
				this.#evalEngine.addRule({
					name: "rule",
					conditions: condition,
					event: {
						type: "success",
					},
				});
				const { events } = await this.#evalEngine.run();
				if (events[0]) return true;
			}
			return false;
		} catch (e) {
			console.error(e);
			return false;
		}
	}
	constructor(config: AccessControlConfig<S, Actions, ResourceMap>) {
		this.#config = config;
	}

	can(subject: S): {
		[A in Actions[number]]: (
			arg:
				| ResourceMap[keyof ResourceMap]
				| ResourceMap[keyof ResourceMap]["type"],
		) => Promise<boolean>;
	} {
		const api: ActionMethodMap<Actions, ResourceMap> = {} as ActionMethodMap<
			Actions,
			ResourceMap
		>;

		for (const action of this.#config.actions) {
			api[action as Actions[number]] = (arg) =>
				this.#checkAccess(subject, action, arg);
		}
		return Object.freeze(api);
	}
}
