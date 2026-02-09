import type { OperatorForRelation } from "@/registry/lib/auth/types/operator";
import type { AuthContext } from "@/registry/lib/auth/types/policy";
import type { BaseResource } from "@/registry/lib/auth/types/resource";
import type { BaseSubject } from "@/registry/lib/auth/types/subject";

type Primitive = string | boolean | number | bigint;

type DotPathMap<T, Prefix extends string = ""> = {
	[K in keyof T & string]-?: T[K] extends Primitive
		? { path: `${Prefix}${K}`; type: T[K] }
		: T[K] extends Date
			? { path: `${Prefix}${K}`; type: Date }
			: T[K] extends Array<infer U>
				? { path: `${Prefix}${K}`; type: Array<U> }
				: T[K] extends Record<string, unknown>
					? DotPathMap<T[K], `${Prefix}${K}.`>
					: never;
}[keyof T & string];

type ElementType<T> = T extends ReadonlyArray<infer U> ? U : T;

type PathRegistry<
	S extends BaseSubject,
	Resource extends BaseResource<string>,
	RequiresResource extends boolean,
> = DotPathMap<AuthContext<S, Resource, RequiresResource>>;

export type ConditionNode<
	S extends BaseSubject,
	Resource extends BaseResource<string>,
	RequiresResource extends boolean,
> =
	PathRegistry<S, Resource, RequiresResource> extends infer P extends {
		path: string;
		type: Primitive | Date | Array<infer _U>;
	}
		? {
				[K in P as K["path"]]: //literal values
					| {
							path: `$.${K["path"]}`;
							operator: OperatorForRelation<K["type"], K["type"]>;
							value: K["type"];
					  }
					| {
							path: `$.${K["path"]}`;
							operator: OperatorForRelation<K["type"], ElementType<K["type"]>>;
							value: ElementType<K["type"]>;
					  }
					| {
							path: `$.${K["path"]}`;
							operator: OperatorForRelation<
								K["type"],
								ElementType<K["type"]>[]
							>;
							value: ElementType<K["type"]>[];
					  }
					// value by path
					| {
							path: `$.${K["path"]}`;
							operator: OperatorForRelation<K["type"], K["type"]>;
							value: `$.${Exclude<Extract<P, { type: K["type"] }>["path"], K["path"]>}`;
					  }
					| {
							path: `$.${K["path"]}`;
							operator: OperatorForRelation<K["type"], ElementType<K["type"]>>;
							value: `$.${Exclude<Extract<P, { type: ElementType<K["type"]> }>["path"], K["path"]>}`;
					  }
					| {
							path: `$.${K["path"]}`;
							operator: OperatorForRelation<
								K["type"],
								ElementType<K["type"]>[]
							>;
							value: `$.${Exclude<Extract<P, { type: ElementType<K["type"]>[] }>["path"], K["path"]>}`;
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
