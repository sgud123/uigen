import { describe, test, expect, beforeEach } from "vitest";
import {
  setHasAnonWork,
  getHasAnonWork,
  getAnonWorkData,
  clearAnonWork,
} from "@/lib/anon-work-tracker";

// jsdom provides window / sessionStorage automatically in this test env.

beforeEach(() => {
  sessionStorage.clear();
});

// ---------------------------------------------------------------------------
// setHasAnonWork
// ---------------------------------------------------------------------------
describe("setHasAnonWork", () => {
  test("persists data when messages array is non-empty", () => {
    setHasAnonWork([{ role: "user", content: "hello" }], {});
    expect(sessionStorage.getItem("uigen_has_anon_work")).toBe("true");
  });

  test("persists data when fileSystemData has entries beyond root", () => {
    const fileSystemData = { "/": { type: "directory" }, "/App.tsx": { type: "file" } };
    setHasAnonWork([], fileSystemData);
    expect(sessionStorage.getItem("uigen_has_anon_work")).toBe("true");
  });

  test("does NOT persist when messages is empty and fileSystemData only has root", () => {
    setHasAnonWork([], { "/": { type: "directory" } });
    expect(sessionStorage.getItem("uigen_has_anon_work")).toBeNull();
  });

  test("does NOT persist when both messages and fileSystemData are empty", () => {
    setHasAnonWork([], {});
    expect(sessionStorage.getItem("uigen_has_anon_work")).toBeNull();
  });

  test("stores messages and fileSystemData as JSON", () => {
    const messages = [{ role: "user", content: "build me a button" }];
    const fileSystemData = { "/Button.tsx": "export default function Button() {}" };
    setHasAnonWork(messages, fileSystemData);

    const stored = JSON.parse(sessionStorage.getItem("uigen_anon_data")!);
    expect(stored.messages).toEqual(messages);
    expect(stored.fileSystemData).toEqual(fileSystemData);
  });

  test("overwrites previously stored data on subsequent calls", () => {
    setHasAnonWork([{ role: "user", content: "first" }], {});
    setHasAnonWork(
      [{ role: "user", content: "second" }],
      { "/index.ts": "..." }
    );

    const stored = JSON.parse(sessionStorage.getItem("uigen_anon_data")!);
    expect(stored.messages[0].content).toBe("second");
  });
});

// ---------------------------------------------------------------------------
// getHasAnonWork
// ---------------------------------------------------------------------------
describe("getHasAnonWork", () => {
  test("returns false when nothing is stored", () => {
    expect(getHasAnonWork()).toBe(false);
  });

  test("returns true after setHasAnonWork stores data", () => {
    setHasAnonWork([{ role: "user", content: "hi" }], {});
    expect(getHasAnonWork()).toBe(true);
  });

  test("returns false after clearAnonWork", () => {
    setHasAnonWork([{ role: "user", content: "hi" }], {});
    clearAnonWork();
    expect(getHasAnonWork()).toBe(false);
  });

  test("returns false when flag is any value other than 'true'", () => {
    sessionStorage.setItem("uigen_has_anon_work", "yes");
    expect(getHasAnonWork()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getAnonWorkData
// ---------------------------------------------------------------------------
describe("getAnonWorkData", () => {
  test("returns null when nothing is stored", () => {
    expect(getAnonWorkData()).toBeNull();
  });

  test("returns stored messages and fileSystemData", () => {
    const messages = [{ role: "assistant", content: "here you go" }];
    const fileSystemData = { "/App.tsx": "const App = () => null;" };
    setHasAnonWork(messages, fileSystemData);

    const data = getAnonWorkData();
    expect(data).not.toBeNull();
    expect(data!.messages).toEqual(messages);
    expect(data!.fileSystemData).toEqual(fileSystemData);
  });

  test("returns null when stored data is invalid JSON", () => {
    sessionStorage.setItem("uigen_anon_data", "{ not valid json");
    expect(getAnonWorkData()).toBeNull();
  });

  test("returns null after clearAnonWork removes the data key", () => {
    setHasAnonWork([{ role: "user", content: "test" }], {});
    clearAnonWork();
    expect(getAnonWorkData()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// clearAnonWork
// ---------------------------------------------------------------------------
describe("clearAnonWork", () => {
  test("removes both storage keys", () => {
    setHasAnonWork([{ role: "user", content: "data" }], { "/a.ts": "x" });
    clearAnonWork();

    expect(sessionStorage.getItem("uigen_has_anon_work")).toBeNull();
    expect(sessionStorage.getItem("uigen_anon_data")).toBeNull();
  });

  test("is safe to call when nothing is stored", () => {
    expect(() => clearAnonWork()).not.toThrow();
  });

  test("calling clear twice is idempotent", () => {
    setHasAnonWork([{ role: "user", content: "data" }], {});
    clearAnonWork();
    clearAnonWork();
    expect(getHasAnonWork()).toBe(false);
  });
});
