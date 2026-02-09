type BaseOperators = "equal" | "notEqual";

type StringOperators = BaseOperators;

type NumberOperators =
	| BaseOperators
	| "greaterThan"
	| "greaterThanInclusive"
	| "lessThan"
	| "lessThanInclusive";

type BooleanOperators = BaseOperators;

type DateOperators =
	| NumberOperators
	| "elapsedGreaterThan"
	| "elapsedGreaterThanInclusive"
	| "elapsedLessThan"
	| "elapsedLessThanInclusive"
	| "remainingGreaterThan"
	| "remainingGreaterThanInclusive"
	| "remainingLessThan"
	| "remainingLessThanInclusive";

type ArrayOperators = BaseOperators;

type MembershipOperators = "includes" | "in";

type OperatorFor<T> = T extends string
	? StringOperators
	: T extends number
		? NumberOperators
		: T extends bigint
			? NumberOperators
			: T extends boolean
				? BooleanOperators
				: T extends Date
					? DateOperators
					: T extends Array<unknown>
						? ArrayOperators
						: never;

export type OperatorForRelation<T, S> =
	T extends Array<unknown>
		? S extends Array<unknown>
			? ArrayOperators
			: Extract<MembershipOperators, "includes">
		: S extends Array<unknown>
			? Extract<MembershipOperators, "in">
			: OperatorFor<T>;
