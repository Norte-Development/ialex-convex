import assert from "node:assert/strict";
import { test } from "node:test";
import type { Request, Response } from "express";
import type { SessionState, SessionStore } from "../src/lib/sessionStore";
import { reauthHandler, type ReauthDependencies } from "../src/routes/reauth";

interface MockResponseState {
  statusCode: number;
  body: unknown;
}

class MockResponse {
  public state: MockResponseState = {
    statusCode: 200,
    body: undefined,
  };

  status(code: number): this {
    this.state.statusCode = code;
    return this;
  }

  json(body: unknown): this {
    this.state.body = body;
    return this;
  }
}

function createRequest(body: unknown): Request {
  return {
    body,
  } as Request;
}

function createDeps(overrides?: Partial<ReauthDependencies>): ReauthDependencies {
  const sessionStore: SessionStore = {
    // Only saveSession is used by the handler
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async loadSession(userId: string): Promise<SessionState | null> {
      return null;
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async saveSession(userId: string, sessionState: SessionState): Promise<boolean> {
      return true;
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async deleteSession(userId: string): Promise<boolean> {
      return true;
    },
  } as unknown as SessionStore;

  const deps: ReauthDependencies = {
    sessionStore,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    performLogin: async (opts: { username: string; password: string }) => {
      const session: SessionState = {
        cookies: ["mockCookie=1"],
        headers: { "x-mock": "1" },
      };
      return session;
    },
  };

  return {
    ...deps,
    ...overrides,
  };
}

test("reauthHandler returns 400 for invalid request body", async () => {
  const req = createRequest({}); // Missing required fields
  const res = new MockResponse();

  await reauthHandler(req, res as unknown as Response, createDeps());

  assert.equal(res.state.statusCode, 400);
  const body = res.state.body as { status: string; code?: string };
  assert.equal(body.status, "ERROR");
  assert.equal(body.code, "VALIDATION_ERROR");
});

test("reauthHandler returns OK and saves session on success", async () => {
  const req = createRequest({
    userId: "user-1",
    username: "testuser",
    password: "secret",
  });
  const res = new MockResponse();

  let savedUserId: string | null = null;
  let savedSession: SessionState | null = null;

  const deps = createDeps({
    sessionStore: {
      async loadSession(): Promise<SessionState | null> {
        return null;
      },
      async saveSession(userId: string, session: SessionState): Promise<boolean> {
        savedUserId = userId;
        savedSession = session;
        return true;
      },
      async deleteSession(): Promise<boolean> {
        return true;
      },
    } as unknown as SessionStore,
  });

  await reauthHandler(req, res as unknown as Response, deps);

  assert.equal(res.state.statusCode, 200);
  const body = res.state.body as { status: string; sessionSaved: boolean };
  assert.equal(body.status, "OK");
  assert.equal(body.sessionSaved, true);
  assert.equal(savedUserId, "user-1");
  assert(savedSession !== null);
});

test("reauthHandler returns AUTH_FAILED on invalid credentials", async () => {
  const req = createRequest({
    userId: "user-1",
    username: "testuser",
    password: "bad-password",
  });
  const res = new MockResponse();

  const deps = createDeps({
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    performLogin: async (opts: { username: string; password: string }) => {
      throw new Error("Invalid credentials");
    },
  });

  await reauthHandler(req, res as unknown as Response, deps);

  // Default status is 200 when AUTH_FAILED is returned
  assert.equal(res.state.statusCode, 200);
  const body = res.state.body as { status: string; reason: string };
  assert.equal(body.status, "AUTH_FAILED");
  assert.match(body.reason, /Invalid credentials/);
});

test("reauthHandler returns 500 when session save fails", async () => {
  const req = createRequest({
    userId: "user-1",
    username: "testuser",
    password: "secret",
  });
  const res = new MockResponse();

  const deps = createDeps({
    sessionStore: {
      async loadSession(): Promise<SessionState | null> {
        return null;
      },
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      async saveSession(userId: string, session: SessionState): Promise<boolean> {
        return false;
      },
      async deleteSession(): Promise<boolean> {
        return true;
      },
    } as unknown as SessionStore,
  });

  await reauthHandler(req, res as unknown as Response, deps);

  assert.equal(res.state.statusCode, 500);
  const body = res.state.body as { status: string; error: string };
  assert.equal(body.status, "ERROR");
  assert.equal(body.error, "Failed to save session");
});

test("reauthHandler returns 500 on infrastructure error (browser launch failure)", async () => {
  const req = createRequest({
    userId: "user-1",
    username: "testuser",
    password: "secret",
  });
  const res = new MockResponse();

  const deps = createDeps({
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    performLogin: async (opts: { username: string; password: string }) => {
      // Simulates a browser/playwright infrastructure error
      throw new Error("Browser launch failed: ECONNREFUSED");
    },
  });

  await reauthHandler(req, res as unknown as Response, deps);

  // Infrastructure errors should return 500, not AUTH_FAILED
  assert.equal(res.state.statusCode, 500);
  const body = res.state.body as { status: string; error: string };
  assert.equal(body.status, "ERROR");
  assert.match(body.error, /Browser launch failed/);
});

test("reauthHandler returns 500 for form field errors (not credentials)", async () => {
  const req = createRequest({
    userId: "user-1",
    username: "testuser",
    password: "secret",
  });
  const res = new MockResponse();

  const deps = createDeps({
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    performLogin: async (opts: { username: string; password: string }) => {
      // Form field errors should NOT be treated as auth failure
      throw new Error("Unable to locate PJN login form field: username");
    },
  });

  await reauthHandler(req, res as unknown as Response, deps);

  // Only "Invalid credentials" is AUTH_FAILED; other errors are 500
  assert.equal(res.state.statusCode, 500);
  const body = res.state.body as { status: string; error: string };
  assert.equal(body.status, "ERROR");
  assert.match(body.error, /Unable to locate/);
});


