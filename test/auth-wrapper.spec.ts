import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccessControl } from "@/registry/lib/auth/abac";
import { withAuth } from "@/registry/lib/auth/auth-wrapper";

// Minimal fake subject and resource types
type TestSubject = { id: string; role: string };
type TestResource = { id: string; type: "doc"; ownerId: string };

describe("AuthWrapper", () => {
	const actions = ["read", "edit", "delete"] as const;

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
		vi.restoreAllMocks();
	});
	it("test wrapper without extracting resource from wrapped fn args", async () => {
		mockGetConditions.mockResolvedValueOnce([
			{
				kind: "all",
				conditions: [
					{ path: "$.subject.role", operator: "equal", value: "admin" },
				],
			},
		]);
		const fnWithoutResource = (message: string) => {
			return message;
		};
		const wrappedFn = withAuth({
			subject: subject,
			ac: ac,
			action: "delete",
			extractResource: false,
			fn: fnWithoutResource,
			resource: "doc",
		});
		const result = await wrappedFn("authorized");
		expect(result).toBe("authorized");
	});

	it("test wrapper with extracting resource from wrapped fn args", async () => {
		mockGetConditions.mockResolvedValueOnce([
			{
				kind: "all",
				conditions: [
					{
						path: "$.subject.id",
						operator: "equal",
						value: "$.resource.ownerId",
					},
				],
			},
		]);
		const fnWithResource = (resource: TestResource) => {
			return resource.ownerId;
		};
		const wrappedFn = withAuth({
			subject: subject,
			ac: ac,
			action: "delete",
			extractResource: true,
			fn: fnWithResource,
		});
		const result = await wrappedFn(resource);
		expect(result).toBe("u1");
	});

	it("it throws when resource/resource can't be resolved", async () => {
		mockGetConditions.mockResolvedValueOnce([
			{
				kind: "all",
				conditions: [
					{
						path: "$.subject.id",
						operator: "equal",
						value: "$.resource.ownerId",
					},
				],
			},
		]);
		const fnWithResource = (resource: string) => {
			return resource;
		};
		//@ts-expect-error
		const wrappedFn = withAuth({
			subject: subject,
			ac: ac,
			action: "delete",
			extractResource: true,
			fn: fnWithResource,
		});
		//@ts-expect-error
		await expect(wrappedFn("error")).rejects.toThrow(
			/Can't determine the resource type/,
		);
	});

	it("it throws when authorization fails", async () => {
		mockGetConditions.mockReset();
		mockGetConditions.mockResolvedValueOnce([
			{
				kind: "all",
				conditions: [
					{
						path: "$.subject.id",
						operator: "notEqual",
						value: "$.resource.ownerId",
					},
				],
			},
		]);
		const fnWithResource = (resource: TestResource) => {
			return resource.ownerId;
		};
		const wrappedFn1 = withAuth({
			subject: subject,
			ac: ac,
			action: "delete",
			extractResource: true,
			fn: fnWithResource,
		});
		await expect(wrappedFn1(resource)).rejects.toThrow(/Not Authorized/);
	});
});
