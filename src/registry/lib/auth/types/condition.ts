import type { OperatorFor } from "@/registry/lib/auth/types/operator";
import type { AuthContext } from "@/registry/lib/auth/types/policy";
import type { BaseResource } from "@/registry/lib/auth/types/resource";
import type { BaseSubject } from "@/registry/lib/auth/types/subject";

type Primitive = string | boolean | number | bigint;
type Fact = "context";

type DotPathMap<T, Prefix extends string = ""> = {
	[K in keyof T & string]-?: NonNullable<T[K]> extends Primitive
		? { path: `${Prefix}${K}`; type: NonNullable<T[K]> }
		: NonNullable<T[K]> extends Date
			? { path: `${Prefix}${K}`; type: Date }
			: NonNullable<T[K]> extends Array<infer U>
				? { path: `${Prefix}${K}`; type: Array<U> }
				: NonNullable<T[K]> extends Record<string, unknown>
					? DotPathMap<NonNullable<T[K]>, `${Prefix}${K}.`>
					: never;
}[keyof T & string];

type PathRegistry<
	S extends BaseSubject,
	Resource extends BaseResource<string>,
	RequiresResource extends boolean,
> = DotPathMap<AuthContext<S, Resource, RequiresResource>>;

export type ConditionNode<
	S extends BaseSubject,
	Resource extends BaseResource<string>,
	RequiresResource extends boolean,
> = PathRegistry<S, Resource, RequiresResource> extends infer P extends {
	path: string;
	type: Primitive | Date | Array<infer _U>;
}
	? {
			[K in P as K["path"]]: {
				fact: Fact;
				path: `$.${K["path"]}`;
				operator: OperatorFor<K["type"]>;
				value:
					| K["type"]
					| {
							fact: Fact;
							path: `$.${Exclude<Extract<P, { type: K["type"] }>["path"], K["path"]>}`;
					  };
			};
		}[P["path"]]
	: never;

export type Condition<
	S extends BaseSubject,
	Resource extends BaseResource<string>,
	RequiresResource extends boolean,
> =
	| {
			kind: "all";
			all: (
				| ConditionNode<S, Resource, RequiresResource>
				| Condition<S, Resource, RequiresResource>
			)[];
	  }
	| {
			kind: "any";
			any: (
				| ConditionNode<S, Resource, RequiresResource>
				| Condition<S, Resource, RequiresResource>
			)[];
	  };
