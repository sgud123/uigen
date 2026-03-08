import { describe, test, expect, beforeEach, vi } from "vitest";
import { VirtualFileSystem } from "@/lib/file-system";

// Mock the "ai" module so tool() is a transparent passthrough
vi.mock("ai", () => ({
  tool: (config: unknown) => config,
}));

import { buildFileManagerTool } from "@/lib/tools/file-manager";

type ToolLike = {
  execute: (args: { command: string; path: string; new_path?: string }) => Promise<unknown>;
};

describe("buildFileManagerTool", () => {
  let fs: VirtualFileSystem;
  let fileMgr: ToolLike;

  beforeEach(() => {
    fs = new VirtualFileSystem();
    fileMgr = buildFileManagerTool(fs) as unknown as ToolLike;
  });

  // ---------------------------------------------------------------------------
  // rename command
  // ---------------------------------------------------------------------------
  describe("rename command", () => {
    test("renames a file successfully", async () => {
      fs.createFile("/old.txt", "content");
      const result = await fileMgr.execute({
        command: "rename",
        path: "/old.txt",
        new_path: "/new.txt",
      });
      expect(result).toEqual({
        success: true,
        message: "Successfully renamed /old.txt to /new.txt",
      });
      expect(fs.exists("/old.txt")).toBe(false);
      expect(fs.exists("/new.txt")).toBe(true);
      expect(fs.readFile("/new.txt")).toBe("content");
    });

    test("moves a file to a different directory", async () => {
      fs.createFile("/src/utils.ts", "export {}");
      const result = await fileMgr.execute({
        command: "rename",
        path: "/src/utils.ts",
        new_path: "/lib/utils.ts",
      });
      expect(result).toMatchObject({ success: true });
      expect(fs.exists("/src/utils.ts")).toBe(false);
      expect(fs.exists("/lib/utils.ts")).toBe(true);
    });

    test("creates parent directories when renaming to nested path", async () => {
      fs.createFile("/file.txt", "data");
      await fileMgr.execute({
        command: "rename",
        path: "/file.txt",
        new_path: "/deep/nested/path/file.txt",
      });
      expect(fs.exists("/deep/nested/path/file.txt")).toBe(true);
      expect(fs.readFile("/deep/nested/path/file.txt")).toBe("data");
    });

    test("renames a directory and all its contents", async () => {
      fs.createDirectory("/src");
      fs.createFile("/src/index.ts", "main");
      fs.createFile("/src/App.tsx", "app");

      const result = await fileMgr.execute({
        command: "rename",
        path: "/src",
        new_path: "/app",
      });
      expect(result).toMatchObject({ success: true });
      expect(fs.exists("/src")).toBe(false);
      expect(fs.exists("/app/index.ts")).toBe(true);
      expect(fs.exists("/app/App.tsx")).toBe(true);
      expect(fs.readFile("/app/index.ts")).toBe("main");
    });

    test("returns error when new_path is not provided", async () => {
      fs.createFile("/file.txt", "content");
      const result = await fileMgr.execute({
        command: "rename",
        path: "/file.txt",
      });
      expect(result).toEqual({
        success: false,
        error: "new_path is required for rename command",
      });
      expect(fs.exists("/file.txt")).toBe(true);
    });

    test("returns error when source does not exist", async () => {
      const result = await fileMgr.execute({
        command: "rename",
        path: "/nonexistent.txt",
        new_path: "/dest.txt",
      });
      expect(result).toMatchObject({ success: false });
      expect((result as { error: string }).error).toContain(
        "/nonexistent.txt"
      );
    });

    test("returns error when destination already exists", async () => {
      fs.createFile("/source.txt", "source");
      fs.createFile("/dest.txt", "dest");
      const result = await fileMgr.execute({
        command: "rename",
        path: "/source.txt",
        new_path: "/dest.txt",
      });
      expect(result).toMatchObject({ success: false });
      expect(fs.readFile("/source.txt")).toBe("source");
      expect(fs.readFile("/dest.txt")).toBe("dest");
    });
  });

  // ---------------------------------------------------------------------------
  // delete command
  // ---------------------------------------------------------------------------
  describe("delete command", () => {
    test("deletes a file successfully", async () => {
      fs.createFile("/remove-me.txt", "to delete");
      const result = await fileMgr.execute({
        command: "delete",
        path: "/remove-me.txt",
      });
      expect(result).toEqual({
        success: true,
        message: "Successfully deleted /remove-me.txt",
      });
      expect(fs.exists("/remove-me.txt")).toBe(false);
    });

    test("deletes a directory recursively", async () => {
      fs.createDirectory("/src");
      fs.createDirectory("/src/components");
      fs.createFile("/src/index.ts", "");
      fs.createFile("/src/components/Button.tsx", "");

      const result = await fileMgr.execute({
        command: "delete",
        path: "/src",
      });
      expect(result).toMatchObject({ success: true });
      expect(fs.exists("/src")).toBe(false);
      expect(fs.exists("/src/components")).toBe(false);
      expect(fs.exists("/src/components/Button.tsx")).toBe(false);
    });

    test("returns error when path does not exist", async () => {
      const result = await fileMgr.execute({
        command: "delete",
        path: "/nonexistent.txt",
      });
      expect(result).toMatchObject({ success: false });
      expect((result as { error: string }).error).toContain(
        "/nonexistent.txt"
      );
    });

    test("returns error when trying to delete root", async () => {
      const result = await fileMgr.execute({
        command: "delete",
        path: "/",
      });
      expect(result).toMatchObject({ success: false });
    });
  });

  // ---------------------------------------------------------------------------
  // invalid command
  // ---------------------------------------------------------------------------
  test("returns error for an unrecognized command", async () => {
    const result = await fileMgr.execute({
      command: "invalid_command",
      path: "/file.txt",
    });
    expect(result).toEqual({ success: false, error: "Invalid command" });
  });
});
