# Custom shadcn registry for Attribute Based Access Control (ABAC) system


> [!WARNING]
> **Alpha quality**
>
> This project is alpha-quality software and may break unexpectedly. Use at your own risk. You are responsible for auditing the security and correctness of this code before using it in production.

This repository provides a small, strongly-typed, and fully serializable ABAC helper set intended to be copied into your project by the shadcn CLI. It focuses on type-safety, runtime-evaluable Conditions, and easy persistence of entitlements/policies.

### Installation

Add "Access Controll" lib from this registry via the shadcn CLI

`
npx shadcn@latest add https://registry.frad-fardeen.workers.dev/r/access-control.json
`

### Key files

- `src/registry/lib/auth/abac.ts` — AccessControl implementation.
- `src/registry/lib/auth/eval.ts` — Condition parsing/eval implementation.
- `src/registry/lib/auth/types/*` — Strongly-typed building blocks:
  - `subject.ts`, `resource.ts`, `condition.ts`, `operator.ts`, `policy.ts`, `entitlement.ts`

### Core ideas

- Types-first: compile-time guarantees for Subjects, Actions and Resources via generics.
- Serializable rules: Conditions, Entitlements and Policies are plain JSON-compatible structures that can be stored in DBs, KV stores, or sent over the network.
- Pluggable runtime: AccessControl accepts an async `getConditions` function that you implement to load rules (from in-memory, DB, KV, etc.) and convert them to executable Condition structures.

### Primary helper types

- BaseSubject — a simple object with attributes you use in checks (e.g. `{ id: string }`).
- BaseResource<T extends string> — `{ type: T; [key: string]: unknown }`. The `type` literal discriminates resource shapes.
- WithType<T, R> — helper to add a `type` literal to a resource shape.
- BaseResourceMap — maps resource type literal keys to their resource types; used to strongly type APIs.
- Condition<S, R, RB> — the runtime-evaluable condition AST (fact, operator, path, nested facts, all or any compositions). RB indicates whether resource references are allowed.
- Operator — allowed comparison operators (equal, notEqual, etc.).
- Policy — named collection of Conditions and metadata.
- Entitlement — minimal serializable descriptor that references Policies or encodes Conditions; intended to be persisted.

#### How generics fit together

AccessControl<S, Actions, ResourceMap>
- S: Subject type (extends BaseSubject)
- Actions: a readonly tuple of action string literals (e.g. readonly ["read","edit"])
- ResourceMap: BaseResourceMap describing resource shapes

#### Constructor config:
- actions: ReadonlyArray<string> (the same tuple type used in generics)
- getConditions: async (subject: S, resourceOrType: Resource | string, action: Action, requiresResource: boolean) => Promise<Condition<S, Resource, boolean>[]>
  - requiresResource is true when a resource instance was passed to the check (so Conditions can reference resource fields).

###  Usage: minimal example

creating types for subject, resources, actions...
```ts
import { AccessControl } from "@/registry/lib/auth/abac";
import type { Condition } from "@/registry/lib/auth/types/condition";
import type { Entitlement } from "@/registry/lib/auth/types/entitlement";
import type { BaseResourceMap } from "@/registry/lib/auth/types/resource";

type User = { id: number; name: string; role: "user" | "admin" };
type Doc = {
	type: "doc";
	ownerId: number;
	published: boolean;
	editors?: number[];
};
type Image = { type: "image"; ownerId: number };

type ResourceMap = BaseResourceMap<{ doc: Doc; image: Image }>;

const ACTIONS = ["read", "edit"] as const;
type Actions = typeof ACTIONS;
```
In-line / in-code entitlements (serializable)

Entitlements are plain objects you can keep in source, JSON files, or a DB.
At runtime, getConditions reads entitlements and converts them to Condition ASTs.
Example entitlement store (could be DB rows / KV values):
```ts
const entitlement = {
	id: 123,
	title: "doc access policies",
	description: "",
	resource: "doc",
	policies: {
		edit: {
			requiresResource: true,
			conditions: {
				kind: "any",
				any: [
					// serialized condition: subject.id == resource.ownerId
					{
						path: "$.subject.id",
						operator: "equal",
						value: "$.resource.ownerId",
					},
					// serialized condition: subject.id in editors list.
					{
						path: "$.subject.id",
						operator: "in",
						value: "$.resource.editors",
					},
					// serialized condition: subject.role === admin.
					{
						path: "$.subject.role",
						operator: "equal",
						value: "admin",
					},
				],
			},
		},
		read: {
			requiresResource: true,
			conditions: {
				kind: "all",
				all: [
					// comparison with literal values
					{
						path: "$.resource.published",
						operator: "equal",
						value: true,
					},
				],
			},
		},
	},
} satisfies Entitlement<User, Doc, typeof ACTIONS>;
```
AccessControl instantiation and getConditions

```ts
const ac = new AccessControl<User, Actions, ResourceMap>({
	actions: ACTIONS,
	async getConditions(_subject, _resourceOrType, action, _requiresResource) {
		// Load entitlements for this action + resource type (from memory/DB/KV)
		const matches = entitlement.policies[action]?.conditions;

		// Each entitlement.condition already matches the Condition<S, Resource, boolean> shape.
		// If entitlements are stored in DB as JSON, parse and return them here.
		return [matches] as Condition<User, Doc | Image, boolean>[];
	},
});
```
Check examples

```ts
// Check with a resource instance (requiresResource=true)
const allowed = await ac
	.can({ id: 1, name: "User", role: "user" })
	.read({ type: "doc", ownerId: 1, published: true });
// Check by resource type only (requiresResource=false)
const allowedByType = await ac
	.can({ id: 2, name: "Admin", role: "admin" })
	.edit("doc");
```

### Serialization & persistence

Conditions, Policies and Entitlements are simple JSON-compatible objects (no functions).You can:store them in a relational DB as JSON columns, write them into KV stores, S3, or files and transfer them between services.
When loaded, getConditions should rehydrate these objects (if needed) and return Condition ASTs that the AccessControl evaluator runs against the provided evaluation context ({ subject, resource }).

### Best practices

- Keep entitlements minimal and referenceable: prefer referencing policy IDs or small condition objects.
- When adding new operators or facts, update the operator types implementations in src/registry/lib/auth/types.
- Use the ResourceMap generic to get exhaustive type-checking when your code enumerates resource types or accesses resource-specific fields in typed code.
- Normalize entitlements in your DB into relations/collections such as entitlements, policies, and conditions. Store conditions as small JSON blobs referenced by policies so, at retrieval time, you can query only the subset of policies/conditions relevant to the requested action/resource/subject. This reduces rows read and the number of conditions evaluated, improving performance and cost.


### Appendix: where to look in code

**Condition AST shape and allowed operators:** `src/registry/lib/auth/types/operator.ts`  
**Policy & Entitlement types:** `src/registry/lib/auth/types/policy.ts, entitlement.ts`  
**AccessControl runtime and evaluator:** `src/registry/lib/auth/abac.ts, eval.ts`

_This registry is designed so you can persist human-readable, serializable entitlement objects and evaluate them in a type-safe manner at runtime._
