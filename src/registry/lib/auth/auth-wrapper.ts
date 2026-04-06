import type { AccessControl } from "@/registry/lib/auth/abac";
import { AuthError } from "@/registry/lib/auth/error";
import type { BaseResource } from "@/registry/lib/auth/types/resource";
import type { BaseSubject } from "@/registry/lib/auth/types/subject";

export function withAuth<
	S extends BaseSubject,
	Actions extends Readonly<Array<string>>,
	ResourceMap extends { [K in keyof ResourceMap]: BaseResource<K & string> },
	// biome-ignore lint/correctness/noUnusedVariables: fn override
	Resource extends ResourceMap[keyof ResourceMap]["type"],
	// biome-ignore lint/suspicious/noExplicitAny: function with any arg can be wrapped
	Args extends [ResourceMap[keyof ResourceMap], ...any[]],
	Ret,
>(options: {
	subject: S | (() => (Promise<S | undefined> | (S | undefined)));
	ac: AccessControl<S, Actions, ResourceMap>;
	action: Actions[number];
	extractResource: true;
	fn: (...args: Args) => Ret | Promise<Ret>;
}): (...args: Args) => Promise<Ret>;

export function withAuth<
	S extends BaseSubject,
	Actions extends Readonly<Array<string>>,
	ResourceMap extends { [K in keyof ResourceMap]: BaseResource<K & string> },
	Resource extends ResourceMap[keyof ResourceMap]["type"],
	// biome-ignore lint/suspicious/noExplicitAny: function with any arg can be wrapped
	Args extends any[],
	Ret,
>(options: {
	subject: S | (() => (Promise<S | undefined> | (S | undefined)));
	ac: AccessControl<S, Actions, ResourceMap>;
	action: Actions[number];
	extractResource: false;
	fn: (...args: Args) => Ret | Promise<Ret>;
	resource: Resource;
}): (...args: Args) => Promise<Ret>;

/**
 * Creates a secured function wrapper that enforces access control
 * before executing the provided function.
 * @param {Object} options - Configuration options.
 * @param {S} options.subject - The subject (e.g., user) performing the action or fn to fetch subject.
 * @param {AccessControl<S, Actions, ResourceMap>} options.ac - Access control instance.
 * @param {Actions[number]} options.action - The action being attempted.
 * @param {boolean} options.extractResource - Whether to extract the resource automatically, valid only when first arg of wrapped method is a valid resource.
 * @param {(...args: Args) => Ret | Promise<Ret>} options.fn - The function to wrap with access control.
 * @param {Resource} [options.resource] - Resource to check access against, required when extractResource is set to false .
 *
 * @returns {(...args: Args) => Promise<Ret>} A function that first performs an authorization check.
 * If the subject is authorized, it executes the wrapped function and resolves with its result.
 * If authorization fails, it throws an AuthError.
 */
export function withAuth<
	S extends BaseSubject,
	Actions extends Readonly<Array<string>>,
	ResourceMap extends { [K in keyof ResourceMap]: BaseResource<K & string> },
	Resource extends ResourceMap[keyof ResourceMap]["type"],
	// biome-ignore lint/suspicious/noExplicitAny: function with any arg can be wrapped
	Args extends any[],
	Ret,
>(options: {
	subject: S | (() => (Promise<S | undefined> | (S | undefined)));
	ac: AccessControl<S, Actions, ResourceMap>;
	action: Actions[number];
	extractResource: boolean;
	fn: (...args: Args) => Ret | Promise<Ret>;
	resource?: Resource;
}): (...args: Args) => Promise<Ret> {
	return async (...args: Args): Promise<Ret> => {
		const { subject, ac, action, extractResource, fn, resource } = options;
		const resolvedSubject = typeof subject === "function" ? await subject() : subject
		if(!resolvedSubject) throw new AuthError("Can't fetch the subject.")
		if (
			resource === undefined &&
			(Array.isArray(args[0]) ||
				typeof args[0] !== "object" ||
				!("type" in args[0]) ||
				typeof args[0].type !== "string")
		)
			throw new AuthError("Can't determine the resource type.");
		const resourceForCheck: ResourceMap[keyof ResourceMap] | Resource =
			extractResource
				? (args[0] as ResourceMap[keyof ResourceMap])
				: (resource as Resource);
		const isAuthorized = await ac.can(resolvedSubject)[action](resourceForCheck);
		if (!isAuthorized) throw new AuthError("Not Authorized.");
		return await fn(...args);
	};
}
