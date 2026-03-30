// src/registry/lib/auth/eval.test.ts

import { describe, expect, it, vi } from "vitest";
import { evaluateCondition } from "../src/registry/lib/auth/eval";
import type {
	Condition,
	ConditionNode,
} from "../src/registry/lib/auth/types/condition";
import type { AuthContext } from "../src/registry/lib/auth/types/policy";
import type { BaseResource } from "../src/registry/lib/auth/types/resource";
import type { BaseSubject } from "../src//registry/lib/auth/types/subject";

type User = { id: number; name: string; age?: number; createdAt?: Date };
type Doc = {
	type: "doc";
	ownerId?: number;
	published: boolean;
	auditors?: number[];
	expiresAt?: Date;
};
function ctx<
	S extends BaseSubject,
	R extends BaseResource<string>,
	Req extends boolean,
>(subject: Partial<S>, resource?: Partial<R>): AuthContext<S, R, Req> {
	return {
		subject: subject,
		resource: resource,
	} as unknown as AuthContext<S, R, Req>;
}

describe("evaluateCondition", () => {
	it("evaluates 'equal' and 'notEqual' operators", () => {
		const node1: ConditionNode<User, Doc, true> = {
			kind: "node",
			path: "$.subject.id",
			operator: "equal",
			value: 5,
		};
		const cond1 = {
			kind: "all",
			all: [node1],
		} satisfies Condition<User, Doc, true>;

		expect(evaluateCondition(cond1, ctx({ id: 5 }))).toBe(true);
		expect(evaluateCondition(cond1, ctx({ id: 7 }))).toBe(false);

		const node2: ConditionNode<User, Doc, true> = {
			kind: "node",
			path: "$.subject.name",
			operator: "notEqual",
			value: "bob",
		};
		const cond2 = {
			kind: "all",
			all: [node2],
		} satisfies Condition<User, Doc, true>;
		expect(evaluateCondition(cond2, ctx({ name: "alice" }))).toBe(true);
		expect(evaluateCondition(cond2, ctx({ name: "bob" }))).toBe(false);
	});

	it("evaluates numeric comparison operators", () => {
		const node: ConditionNode<User, Doc, true> = {
			kind: "node",
			path: "$.subject.age",
			value: 18,
			operator: "greaterThan",
		};
		const condition: Condition<User, Doc, true> = {
			kind: "all",
			all: [node],
		} satisfies Condition<User, Doc, true>;
		expect(evaluateCondition(condition, ctx({ age: 20 }))).toBe(true);
		if ("operator" in condition.all[0])
			condition.all[0].operator = "greaterThanInclusive";
		expect(evaluateCondition(condition, ctx({ age: 18 }))).toBe(true);
		if ("operator" in condition.all[0]) condition.all[0].operator = "lessThan";
		expect(evaluateCondition(condition, ctx({ age: 17 }))).toBe(true);
		if ("operator" in condition.all[0])
			condition.all[0].operator = "lessThanInclusive";
		expect(evaluateCondition(condition, ctx({ age: 18 }))).toBe(true);
	});

	it("evaluates date-based elapsed/remaining operators", () => {
		const now = new Date();
		vi.setSystemTime(now);

		const past = new Date(now.getTime() - 1000 * 60 * 10); // 10 min ago
		const futureShort = new Date(now.getTime() + 1000 * 60 * 10); // 10 min ahead
		const futureLong = new Date(now.getTime() + 1000 * 60 * 20); // 20 min ahead

		// elapsedGreaterThan
		const cond1 = {
			kind: "all",
			all: [
				{
					kind: "node",
					path: "$.subject.createdAt",
					operator: "elapsedGreaterThan",
					value: 1000 * 60 * 5,
				},
			],
		} satisfies Condition<User, Doc, true>;
		expect(evaluateCondition(cond1, ctx({ createdAt: past }))).toBe(true);
		expect(evaluateCondition(cond1, ctx({ createdAt: now }))).toBe(false);

		// elapsedGreaterThanInclusive
		const cond2 = {
			kind: "all",
			all: [
				{
					kind: "node",
					path: "$.subject.createdAt",
					operator: "elapsedGreaterThanInclusive",
					value: 1000 * 60 * 10,
				},
			],
		} satisfies Condition<User, Doc, true>;
		expect(evaluateCondition(cond2, ctx({ createdAt: past }))).toBe(true);
		expect(evaluateCondition(cond2, ctx({ createdAt: now }))).toBe(false);

		// elapsedLessThan
		const cond3 = {
			kind: "all",
			all: [
				{
					kind: "node",
					path: "$.subject.createdAt",
					operator: "elapsedLessThan",
					value: 1000 * 60 * 5,
				},
			],
		} satisfies Condition<User, Doc, true>;
		expect(evaluateCondition(cond3, ctx({ createdAt: past }))).toBe(false);
		expect(evaluateCondition(cond3, ctx({ createdAt: now }))).toBe(true);

		// elapsedLessThanInclusive
		const cond4 = {
			kind: "all",
			all: [
				{
					kind: "node",
					path: "$.subject.createdAt",
					operator: "elapsedLessThanInclusive",
					value: 1000 * 60 * 10,
				},
			],
		} satisfies Condition<User, Doc, true>;
		expect(evaluateCondition(cond4, ctx({ createdAt: past }))).toBe(true);
		expect(evaluateCondition(cond4, ctx({ createdAt: now }))).toBe(true);

		// remainingLessThan
		const cond5 = {
			kind: "all",
			all: [
				{
					kind: "node",
					path: "$.resource.expiresAt",
					operator: "remainingLessThan",
					value: 1000 * 60 * 15,
				},
			],
		} satisfies Condition<User, Doc, true>;
		expect(evaluateCondition(cond5, ctx({}, { expiresAt: futureShort }))).toBe(
			true,
		);
		expect(evaluateCondition(cond5, ctx({}, { expiresAt: futureLong }))).toBe(
			false,
		);

		// remainingLessThanInclusive
		const cond6 = {
			kind: "all",
			all: [
				{
					kind: "node",
					path: "$.resource.expiresAt",
					operator: "remainingLessThanInclusive",
					value: 1000 * 60 * 10,
				},
			],
		} satisfies Condition<User, Doc, true>;
		expect(evaluateCondition(cond6, ctx({}, { expiresAt: futureShort }))).toBe(
			true,
		);
		expect(evaluateCondition(cond6, ctx({}, { expiresAt: futureLong }))).toBe(
			false,
		);

		// remainingGreaterThan
		const cond7 = {
			kind: "all",
			all: [
				{
					kind: "node",
					path: "$.resource.expiresAt",
					operator: "remainingGreaterThan",
					value: 1000 * 60 * 5,
				},
			],
		} satisfies Condition<User, Doc, true>;
		expect(evaluateCondition(cond7, ctx({}, { expiresAt: futureLong }))).toBe(
			true,
		);
		expect(evaluateCondition(cond7, ctx({}, { expiresAt: futureShort }))).toBe(
			true,
		);
		expect(
			evaluateCondition(
				cond7,
				ctx({}, { expiresAt: new Date(now.getTime() + 1000 * 60 * 2) }),
			),
		).toBe(false);

		// remainingGreaterThanInclusive
		const cond8 = {
			kind: "all",
			all: [
				{
					kind: "node",
					path: "$.resource.expiresAt",
					operator: "remainingGreaterThanInclusive",
					value: 1000 * 60 * 20,
				},
			],
		} satisfies Condition<User, Doc, true>;
		expect(evaluateCondition(cond8, ctx({}, { expiresAt: futureLong }))).toBe(
			true,
		);
		expect(evaluateCondition(cond8, ctx({}, { expiresAt: futureShort }))).toBe(
			false,
		);
	});

	it("evaluates array operators 'includes' and 'in'", () => {
		const includesNode: ConditionNode<User, Doc, true> = {
			kind: "node",
			path: "$.resource.auditors",
			operator: "includes",
			value: "$.subject.id",
		};
		const condition1 = {
			kind: "all",
			all: [includesNode],
		} satisfies Condition<User, Doc, true>;
		expect(
			evaluateCondition(condition1, ctx({ id: 1 }, { auditors: [1] })),
		).toBe(true);
		expect(
			evaluateCondition(condition1, ctx({ id: 2 }, { auditors: [1] })),
		).toBe(false);

		const inNode: ConditionNode<User, Doc, true> = {
			kind: "node",
			path: "$.subject.name",
			operator: "in",
			value: ["alice", "bob"],
		};
		const condition2 = {
			kind: "all",
			all: [inNode],
		} satisfies Condition<User, Doc, true>;
		expect(evaluateCondition(condition2, ctx({ name: "alice" }))).toBe(true);
		expect(evaluateCondition(condition2, ctx({ name: "carol" }))).toBe(false);
	});

	it("resolves right-hand side as path if value is a path", () => {
		const node: ConditionNode<User, Doc, true> = {
			kind: "node",
			path: "$.subject.id",
			operator: "equal",
			value: "$.resource.ownerId",
		};
		const condition: Condition<User, Doc, true> = {
			kind: "all",
			all: [node],
		};
		expect(evaluateCondition(condition, ctx({ id: 42 }, { ownerId: 42 }))).toBe(
			true,
		);
		expect(evaluateCondition(condition, ctx({ id: 1 }, { ownerId: 2 }))).toBe(
			false,
		);
	});

	it("evaluates single node condition", () => {
		const node: ConditionNode<User, Doc, true> = {
			kind: "node",
			path: "$.subject.id",
			operator: "equal",
			value: 5,
		};

		expect(evaluateCondition(node, ctx({ id: 5 }))).toBe(true);
		expect(evaluateCondition(node, ctx({ id: 7 }))).toBe(false);
	});

	it("evaluates without kind property present in the node ", () => {
		//@ts-expect-error
		const node1: ConditionNode<User, Doc, true> = {
			path: "$.subject.id",
			operator: "equal",
			value: 5,
		};
		const cond = {
			kind: "all",
			all: [node1],
		} satisfies Condition<User, Doc, true>;

		expect(evaluateCondition(cond, ctx({ id: 5 }))).toBe(true);
		expect(evaluateCondition(cond, ctx({ id: 7 }))).toBe(false);
	});

	it("evaluates 'all' and 'any' condition trees", () => {
		const allCond: Condition<User, Doc, true> = {
			kind: "all",
			all: [
				{ kind: "node", path: "$.subject.id", operator: "equal", value: 1 },
				{
					kind: "node",
					path: "$.resource.ownerId",
					operator: "equal",
					value: 1,
				},
			],
		};
		expect(evaluateCondition(allCond, ctx({ id: 1 }, { ownerId: 1 }))).toBe(
			true,
		);
		expect(evaluateCondition(allCond, ctx({ id: 1 }, { ownerId: 2 }))).toBe(
			false,
		);

		const anyCond: Condition<User, Doc, true> = {
			kind: "any",
			any: [
				{ kind: "node", path: "$.subject.id", operator: "equal", value: 2 },
				{
					kind: "node",
					path: "$.resource.ownerId",
					operator: "equal",
					value: 1,
				},
				{
					kind: "any",
					any: [
						{ kind: "node", path: "$.subject.id", operator: "equal", value: 2 },
						{
							kind: "node",
							path: "$.resource.ownerId",
							operator: "equal",
							value: 1,
						},
					],
				},
			],
		};
		expect(evaluateCondition(anyCond, ctx({ id: 1 }, { ownerId: 1 }))).toBe(
			true,
		);
		expect(evaluateCondition(anyCond, ctx({ id: 2 }, { ownerId: 3 }))).toBe(
			true,
		);
		expect(evaluateCondition(anyCond, ctx({ id: 3 }, { ownerId: 4 }))).toBe(
			false,
		);
	});

	it("supports nested condition trees", () => {
		const nested: Condition<User, Doc, true> = {
			kind: "all",
			all: [
				{
					kind: "any",
					any: [
						{ kind: "node", path: "$.subject.id", operator: "equal", value: 1 },
						{ kind: "node", path: "$.subject.id", operator: "equal", value: 2 },
					],
				},
				{
					kind: "node",
					path: "$.resource.ownerId",
					operator: "equal",
					value: 1,
				},
			],
		};
		expect(evaluateCondition(nested, ctx({ id: 1 }, { ownerId: 1 }))).toBe(
			true,
		);
		expect(evaluateCondition(nested, ctx({ id: 2 }, { ownerId: 1 }))).toBe(
			true,
		);
		expect(evaluateCondition(nested, ctx({ id: 3 }, { ownerId: 1 }))).toBe(
			false,
		);
	});

	it("throws for unsupported operators", () => {
		const node: ConditionNode<User, Doc, true> = {
			path: "$.subject.id",
			//@ts-expect-error
			operator: "unsupported",
			value: 1,
		};
		const condition: Condition<User, Doc, true> = {
			kind: "all",
			all: [node],
		};
		expect(() => evaluateCondition(condition, ctx({ id: 1 }))).toThrow(
			/Unsupported operator/,
		);
	});

	it("throws for non existent path ", () => {
		const condition = {
			kind: "all",
			all: [
				{
					path: "$.subject.id.nonexistent",
					operator: "equal",
					value: "something",
				},
			],
		} as const;
		//@ts-expect-error
		expect(() => evaluateCondition(condition, { subject: { id: 1 } })).toThrow(
			/Path doesn't exists/,
		);
	});

	it("throws for non existent value-path ", () => {
		const condition = {
			kind: "all",
			all: [
				{
					path: "$.subject.id",
					operator: "equal",
					value: "$.subject.id.abc",
				},
			],
		} as const;
		// subject has no 'nonexistent' property, so resolvePath returns undefined
		//@ts-expect-error
		expect(() => evaluateCondition(condition, { subject: { id: 1 } })).toThrow(
			/Path doesn't exists/,
		);
	});

	it("throws for value-path resolved to undefined", () => {
		const condition = {
			kind: "all",
			all: [
				{
					path: "$.subject.id",
					operator: "equal",
					value: "$.subject.abc",
				},
			],
		} as const;
		// subject has no 'nonexistent' property, so resolvePath returns undefined
		expect(() =>
			//@ts-expect-error
			evaluateCondition(condition, { subject: { id: 1, abc: undefined } }),
		).toThrow(/Value-path resolved to undefined/);
	});

	it("returns false for wrong condition type", () => {
		const condition = {
			kind: "none",
			all: [
				{
					path: "$.subject.id.nonexistent",
					operator: "equal",
					value: "something",
				},
			],
		} as const;
		// subject has no 'nonexistent' property, so resolvePath returns undefined
		//@ts-expect-error
		const result = evaluateCondition(condition, { subject: { id: 1 } });
		expect(result).toBe(false);
	});
});
