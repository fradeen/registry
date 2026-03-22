const BASE_OPERATORS = ["equal", "notEqual"] as const;
type BaseOperators = (typeof BASE_OPERATORS)[number];

type StringOperators = BaseOperators;
type BooleanOperators = BaseOperators;
type ArrayOperators = BaseOperators;

const NUMBER_OPERATORS = [
	...BASE_OPERATORS,
	"greaterThan",
	"greaterThanInclusive",
	"lessThan",
	"lessThanInclusive",
] as const;
type NumberOperators = (typeof NUMBER_OPERATORS)[number];

const DATE_OPERATORS = [
	...NUMBER_OPERATORS,
	"elapsedGreaterThan",
	"elapsedGreaterThanInclusive",
	"elapsedLessThan",
	"elapsedLessThanInclusive",
	"remainingGreaterThan",
	"remainingGreaterThanInclusive",
	"remainingLessThan",
	"remainingLessThanInclusive",
] as const;
type DateOperators = (typeof DATE_OPERATORS)[number];

const MEMBERSHIP_OPERATORS = ["includes", "in"] as const;
type MembershipOperators = (typeof MEMBERSHIP_OPERATORS)[number];

export const OPERATORS = [
	...BASE_OPERATORS,
	...NUMBER_OPERATORS,
	...DATE_OPERATORS,
	...MEMBERSHIP_OPERATORS,
] as const;

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
