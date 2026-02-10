import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccessControl } from "@/registry/lib/auth/abac"; // adjust path

// Minimal fake subject and resource types
type TestSubject = { id: string; role: string };
type TestResource = { id: string; type: "doc"; ownerId: string };

describe("AccessControl", () => {
	const actions = ["read", "write"] as const;

	const mockGetConditions = vi.fn();

	const config = {
		actions,
		getConditions: mockGetConditions,
	};

	const ac = new AccessControl<
		TestSubject,
		typeof actions,
		{ doc: TestResource }
	>(config);

	const subject: TestSubject = { id: "u1", role: "admin" };
	const resource: TestResource = { id: "r1", type: "doc", ownerId: "u1" };

	beforeEach(() => {
		vi.spyOn(console, "error").mockImplementation(() => {});
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});
	it("returns frozen API from can()", () => {
		const api = ac.can(subject);
		expect(Object.isFrozen(api)).toBe(true);
		expect(typeof api.read).toBe("function");
		expect(typeof api.write).toBe("function");
	});

	it("denies access when no conditions are returned", async () => {
		mockGetConditions.mockResolvedValueOnce([]);
		const result = await ac.can(subject).read(resource);
		expect(result).toBe(false);
	});

	it("grants access when condition matches (resource object)", async () => {
		mockGetConditions.mockResolvedValueOnce([
			{
				kind: "all",
				all: [{ path: "$.subject.role", operator: "equal", value: "admin" }],
			},
		]);
		const result = await ac.can(subject).read(resource);
		expect(result).toBe(true);
	});

	it("grants access when condition matches (resource type string)", async () => {
		mockGetConditions.mockResolvedValueOnce([
			{
				kind: "any",
				any: [{ path: "$.subject.role", operator: "equal", value: "admin" }],
			},
		]);
		const result = await ac.can(subject).read("doc");
		expect(result).toBe(true);
	});

	it("returns false when condition does not match", async () => {
		mockGetConditions.mockResolvedValueOnce([
			{
				kind: "all",
				all: [{ path: "$.subject.role", operator: "equal", value: "user" }],
			},
		]);
		const result = await ac.can(subject).write(resource);
		expect(result).toBe(false);
	});

	it("handles thrown errors gracefully", async () => {
		mockGetConditions.mockRejectedValueOnce(new Error("DB error"));
		const result = await ac.can(subject).read(resource);
		expect(result).toBe(false);
	});
});
