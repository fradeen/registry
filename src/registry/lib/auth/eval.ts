import includes from "lodash/includes";
import isEqual from "lodash/isEqual";

type BaseNode = { path: string; operator: string; value: unknown };
type BaseCondition =
	| {
			kind: "all";
			all: (BaseNode | BaseCondition)[];
	  }
	| {
			kind: "any";
			any: (BaseNode | BaseCondition)[];
	  };
type BaseContext = {
	subject: Record<string, unknown>;
	resource?: Record<string, unknown>;
};

function resolvePath(context: BaseContext, path: string): unknown {
	const parts = path.replace(/^\$\./, "").split(".");
	return parts.reduce<unknown>((acc, key) => {
		if (acc && typeof acc === "object" && !Array.isArray(acc)) {
			return (acc as Record<string, unknown>)[key];
		}
		return undefined;
	}, context);
}

// Evaluator for a single ConditionNode
function evaluateNode(node: BaseNode, context: BaseContext): boolean {
	const left = resolvePath(context, node.path);
	const right =
		typeof node.value === "string" && node.value.startsWith("$.")
			? resolvePath(context, node.value)
			: node.value;
	const operator = node.operator;
	const now = Date.now();
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
			return now - (left as Date).getTime() > (right as number);
		case "elapsedGreaterThanInclusive":
			return now - (left as Date).getTime() >= (right as number);
		case "elapsedLessThan":
			return now - (left as Date).getTime() < (right as number);
		case "elapsedLessThanInclusive":
			return now - (left as Date).getTime() <= (right as number);
		case "remainingGreaterThan":
			return (left as Date).getTime() - now > (right as number);
		case "remainingGreaterThanInclusive":
			return (left as Date).getTime() - now >= (right as number);
		case "remainingLessThan":
			return (left as Date).getTime() - now < (right as number);
		case "remainingLessThanInclusive":
			return (left as Date).getTime() - now <= (right as number);
		case "includes":
			return Array.isArray(left) && includes(left, right);
		case "in":
			return Array.isArray(right) && includes(right, left);
		default:
			throw new Error(`Unsupported operator: ${operator}`);
	}
}

// Evaluator for a Condition tree
export function evaluateCondition(
	condition: BaseCondition,
	context: BaseContext,
): boolean {
	if (condition.kind === "all") {
		return condition.all.every((c) =>
			"kind" in c ? evaluateCondition(c, context) : evaluateNode(c, context),
		);
	} else if (condition.kind === "any") {
		return condition.any.some((c) =>
			"kind" in c ? evaluateCondition(c, context) : evaluateNode(c, context),
		);
	} else return false;
}
