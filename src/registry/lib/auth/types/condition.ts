import type {
	OPERATORS,
	OperatorForRelation,
} from "@/registry/lib/auth/types/operator";
import type { AuthContext } from "@/registry/lib/auth/types/policy";
import type { BaseResource } from "@/registry/lib/auth/types/resource";
import type { BaseSubject } from "@/registry/lib/auth/types/subject";

export type BaseNode = {
	kind: "node";
	path: string;
	operator: (typeof OPERATORS)[number];
	value: unknown;
};
export type BaseCondition =
	| {
			kind: "all";
			all: (BaseNode | BaseCondition)[];
	  }
	| {
			kind: "any";
			any: (BaseNode | BaseCondition)[];
	  }
	| BaseNode;
type Primitive = string | boolean | number | bigint;

type DotPathMap<T, Prefix extends string = ""> = {
	[K in keyof T & string]-?: NonNullable<T[K]> extends Primitive
		? { path: `${Prefix}${K}`; type: NonNullable<T[K]> }
		: NonNullable<T[K]> extends Date
			? { path: `${Prefix}${K}`; type: Date }
			: NonNullable<T[K]> extends Array<infer U>
				? { path: `${Prefix}${K}`; type: Array<U> }
				: NonNullable<T[K]> extends Record<string, unknown>
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
							kind: "node";
							path: `$.${K["path"]}`;
							operator: OperatorForRelation<K["type"], K["type"]>;
							value: K["type"];
					  }
					| {
							kind: "node";
							path: `$.${K["path"]}`;
							operator: OperatorForRelation<K["type"], ElementType<K["type"]>>;
							value: ElementType<K["type"]> extends Date
								? number | ElementType<K["type"]>
								: ElementType<K["type"]>;
					  }
					| {
							kind: "node";
							path: `$.${K["path"]}`;
							operator: OperatorForRelation<
								K["type"],
								ElementType<K["type"]>[]
							>;
							value: ElementType<K["type"]>[];
					  }
					// value by path
					| {
							kind: "node";
							path: `$.${K["path"]}`;
							operator: OperatorForRelation<K["type"], K["type"]>;
							value: `$.${Exclude<Extract<P, { type: K["type"] }>["path"], K["path"]>}`;
					  }
					| {
							kind: "node";
							path: `$.${K["path"]}`;
							operator: OperatorForRelation<K["type"], ElementType<K["type"]>>;
							value: `$.${Exclude<Extract<P, { type: ElementType<K["type"]> }>["path"], K["path"]>}`;
					  }
					| {
							kind: "node";
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
	  }
	| ConditionNode<S, Resource, RequiresResource>;
