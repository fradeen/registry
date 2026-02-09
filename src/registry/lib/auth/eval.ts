import includes from "lodash/includes";
import isEqual from "lodash/isEqual";
import type {
	Condition,
	ConditionNode,
} from "@/registry/lib/auth/types/condition";
import type { AuthContext } from "@/registry/lib/auth/types/policy";
import type { BaseResource } from "@/registry/lib/auth/types/resource";
import type { BaseSubject } from "@/registry/lib/auth/types/subject";

// Utility to resolve a path like "$.subject.age" into a value from context
function resolvePath<
	S extends BaseSubject,
	R extends BaseResource<string>,
	Req extends boolean,
>(context: AuthContext<S, R, Req>, path: string): unknown {
	const parts = path.replace(/^\$\./, "").split(".");
	return parts.reduce<unknown>((acc, key) => {
		if (acc && typeof acc === "object" && !Array.isArray(acc)) {
			return (acc as Record<string, unknown>)[key];
		}
		return undefined;
	}, context);
}

// Evaluator for a single ConditionNode
function evaluateNode<
	S extends BaseSubject,
	R extends BaseResource<string>,
	Req extends boolean,
>(node: ConditionNode<S, R, Req>, context: AuthContext<S, R, Req>): boolean {
	const left = resolvePath(context, node.path);
	const right =
		typeof node.value === "string" && node.value.startsWith("$.")
			? resolvePath(context, node.value)
			: node.value;
	const operator = node.operator;
	switch (operator) {
		case "equal":
			return isEqual(left, right);
		case "notEqual":
			return !isEqual(left, right);

		case "greaterThan":
			return (left as number | Date) > (right as number | Date);
		case "greaterThanInclusive":
			return (left as number | Date) >= (right as number | Date);
		case "lessThan":
			return (left as number | Date) < (right as number | Date);
		case "lessThanInclusive":
			return (left as number | Date) <= (right as number | Date);
		case "elapsedGreaterThan":
			return Date.now() - (left as Date).getTime() > (right as number);
		case "elapsedGreaterThanInclusive":
			return Date.now() - (left as Date).getTime() >= (right as number);
		case "elapsedLessThan":
			return Date.now() - (left as Date).getTime() < (right as number);
		case "elapsedLessThanInclusive":
			return Date.now() - (left as Date).getTime() <= (right as number);
		case "remainingGreaterThan":
			return (left as Date).getTime() - Date.now() > (right as number);
		case "remainingGreaterThanInclusive":
			return (left as Date).getTime() - Date.now() >= (right as number);
		case "remainingLessThan":
			return (left as Date).getTime() - Date.now() < (right as number);
		case "remainingLessThanInclusive":
			return (left as Date).getTime() - Date.now() <= (right as number);
		case "includes":
			return Array.isArray(left) && includes(left, right);
		case "in":
			return Array.isArray(right) && includes(right, left);
		default:
			throw new Error(`Unsupported operator: ${operator}`);
	}
}

// Evaluator for a Condition tree
export function evaluateCondition<
	S extends BaseSubject,
	R extends BaseResource<string>,
	Req extends boolean,
>(condition: Condition<S, R, Req>, context: AuthContext<S, R, Req>): boolean {
	if (condition.kind === "all") {
		return condition.all.every((c) =>
			"kind" in c ? evaluateCondition(c, context) : evaluateNode(c, context),
		);
	} else {
		return condition.any.some((c) =>
			"kind" in c ? evaluateCondition(c, context) : evaluateNode(c, context),
		);
	}
}
