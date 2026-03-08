// @vitest-environment node
import { describe, test, expect, vi, beforeEach } from "vitest";

// Mock "server-only" so it doesn't throw outside Next.js
vi.mock("server-only", () => ({}));

// Mock next/headers cookies()
const mockGet = vi.fn();
const mockSet = vi.fn();
const mockDelete = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: mockGet,
    set: mockSet,
    delete: mockDelete,
  })),
}));

// Import after mocks are registered
import { createSession, getSession, deleteSession, verifySession } from "@/lib/auth";
import { NextRequest } from "next/server";

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// createSession
// ---------------------------------------------------------------------------
describe("createSession", () => {
  test("sets an httpOnly cookie with a signed JWT", async () => {
    await createSession("user-1", "alice@example.com");

    expect(mockSet).toHaveBeenCalledOnce();
    const [name, token, options] = mockSet.mock.calls[0];
    expect(name).toBe("auth-token");
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3); // JWT format
    expect(options.httpOnly).toBe(true);
    expect(options.path).toBe("/");
  });

  test("sets cookie expiry ~7 days in the future", async () => {
    const before = Date.now();
    await createSession("user-1", "alice@example.com");
    const after = Date.now();

    const [, , options] = mockSet.mock.calls[0];
    const expires: Date = options.expires;
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    expect(expires.getTime()).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
    expect(expires.getTime()).toBeLessThanOrEqual(after + sevenDaysMs + 1000);
  });
});

// ---------------------------------------------------------------------------
// getSession
// ---------------------------------------------------------------------------
describe("getSession", () => {
  test("returns null when no cookie is present", async () => {
    mockGet.mockReturnValue(undefined);

    const session = await getSession();
    expect(session).toBeNull();
  });

  test("returns null for a tampered / invalid token", async () => {
    mockGet.mockReturnValue({ value: "not.a.valid.jwt" });

    const session = await getSession();
    expect(session).toBeNull();
  });

  test("returns session payload for a valid token", async () => {
    // Create a real token first
    await createSession("user-42", "bob@example.com");
    const [, token] = mockSet.mock.calls[0];

    vi.clearAllMocks();
    mockGet.mockReturnValue({ value: token });

    const session = await getSession();
    expect(session).not.toBeNull();
    expect(session?.userId).toBe("user-42");
    expect(session?.email).toBe("bob@example.com");
  });

  test("returned session has an expiresAt date", async () => {
    await createSession("user-1", "alice@example.com");
    const [, token] = mockSet.mock.calls[0];

    vi.clearAllMocks();
    mockGet.mockReturnValue({ value: token });

    const session = await getSession();
    expect(session?.expiresAt).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// deleteSession
// ---------------------------------------------------------------------------
describe("deleteSession", () => {
  test("deletes the auth-token cookie", async () => {
    await deleteSession();

    expect(mockDelete).toHaveBeenCalledOnce();
    expect(mockDelete).toHaveBeenCalledWith("auth-token");
  });
});

// ---------------------------------------------------------------------------
// verifySession
// ---------------------------------------------------------------------------
describe("verifySession", () => {
  function makeRequest(token?: string): NextRequest {
    const url = "http://localhost/api/test";
    const req = new NextRequest(url);
    if (token) {
      // NextRequest cookies are read-only; inject via headers
      return new NextRequest(url, {
        headers: { cookie: `auth-token=${token}` },
      });
    }
    return req;
  }

  test("returns null when no cookie is present", async () => {
    const req = makeRequest();
    const session = await verifySession(req);
    expect(session).toBeNull();
  });

  test("returns null for an invalid token", async () => {
    const req = makeRequest("bad.token.value");
    const session = await verifySession(req);
    expect(session).toBeNull();
  });

  test("returns session payload for a valid token", async () => {
    // Generate a real token via createSession
    await createSession("user-99", "carol@example.com");
    const [, token] = mockSet.mock.calls[0];

    const req = makeRequest(token);
    const session = await verifySession(req);

    expect(session).not.toBeNull();
    expect(session?.userId).toBe("user-99");
    expect(session?.email).toBe("carol@example.com");
  });

  test("returns null for an expired token", async () => {
    // Build a token that expired 1 second ago using jose directly
    const { SignJWT } = await import("jose");
    const secret = new TextEncoder().encode("development-secret-key");
    const expiredToken = await new SignJWT({
      userId: "user-x",
      email: "x@example.com",
      expiresAt: new Date(Date.now() - 1000),
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("-1s")
      .setIssuedAt()
      .sign(secret);

    const req = makeRequest(expiredToken);
    const session = await verifySession(req);
    expect(session).toBeNull();
  });
});
