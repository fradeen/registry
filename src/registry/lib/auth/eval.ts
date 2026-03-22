import includes from "lodash/includes";
import isEqual from "lodash/isEqual";
import type {
	BaseCondition,
	BaseConditionNode,
} from "@/registry/lib/auth/types/condition";
import { NUMBER_OPERATORS } from "@/registry/lib/auth/types/operator";

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

function getType(val: unknown) {
	if (
		val instanceof Date ||
		(Object.prototype.toString.call(val) === "[object Date]" &&
			!Number.isNaN(val))
	)
		return "date";
	if (Array.isArray(val)) return "array";
	return typeof val;
}

function isOperatorCompatible(
	operator: string,
	left: string,
	right: string,
): boolean {
	if (operator === "equal" || operator === "notEqual") return true;
	if (operator.startsWith("remaining") || operator.startsWith("elapsed"))
		return left === "date" && right === "number";
	if ((NUMBER_OPERATORS as readonly string[]).includes(operator))
		return ["number", "bigint", "date"].includes(left) && left === right;
	if (operator === "includes") return left === "array";
	if (operator === "in") return right === "array";
	return false;
}

// Evaluator for a single ConditionNode
function evaluateNode(node: BaseConditionNode, context: BaseContext): boolean {
	const left = resolvePath(context, node.path);
	if (left === undefined) throw new Error(`Path doesn't exists: ${node.path}`);
	let right: unknown;
	if (typeof node.value === "string" && node.value.startsWith("$.")) {
		right = resolvePath(context, node.value);
		if (right === undefined)
			throw new Error(`Path doesn't exists: ${node.value}`);
	} else right = node.value;
	const operator = node.operator;
	const now = Date.now();
	const leftType = getType(left);
	const rightType = getType(right);
	if (!isOperatorCompatible(operator, leftType, rightType)) {
		throw new Error(
			`Unsupported operator: ${operator}, not valid for left=${leftType}, right=${rightType}`,
		);
	}
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
			throw new Error(
				`Unsupported operator: ${operator}, not valid for left=${leftType}, right=${rightType}`,
			);
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
	} else if (condition.kind === "node") {
		return evaluateNode(condition, context);
	} else return false;
}
