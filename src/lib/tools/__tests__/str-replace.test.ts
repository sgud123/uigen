import { describe, test, expect, beforeEach } from "vitest";
import { VirtualFileSystem } from "@/lib/file-system";
import { buildStrReplaceTool } from "@/lib/tools/str-replace";

describe("buildStrReplaceTool", () => {
  let fs: VirtualFileSystem;
  let tool: ReturnType<typeof buildStrReplaceTool>;

  beforeEach(() => {
    fs = new VirtualFileSystem();
    tool = buildStrReplaceTool(fs);
  });

  test("has correct id", () => {
    expect(tool.id).toBe("str_replace_editor");
  });

  // ---------------------------------------------------------------------------
  // view command
  // ---------------------------------------------------------------------------
  describe("view command", () => {
    test("views file content with line numbers", async () => {
      fs.createFile("/test.txt", "line1\nline2\nline3");
      const result = await tool.execute({ command: "view", path: "/test.txt" });
      expect(result).toBe("1\tline1\n2\tline2\n3\tline3");
    });

    test("views file content with view_range", async () => {
      fs.createFile("/test.txt", "line1\nline2\nline3\nline4\nline5");
      const result = await tool.execute({
        command: "view",
        path: "/test.txt",
        view_range: [2, 4],
      });
      expect(result).toBe("2\tline2\n3\tline3\n4\tline4");
    });

    test("views directory contents", async () => {
      fs.createDirectory("/src");
      fs.createFile("/src/index.ts", "");
      fs.createDirectory("/src/components");
      const result = await tool.execute({ command: "view", path: "/src" });
      expect(result).toContain("[FILE] index.ts");
      expect(result).toContain("[DIR] components");
    });

    test("views empty directory", async () => {
      fs.createDirectory("/empty");
      const result = await tool.execute({ command: "view", path: "/empty" });
      expect(result).toBe("(empty directory)");
    });

    test("returns error for non-existent path", async () => {
      const result = await tool.execute({
        command: "view",
        path: "/nonexistent.txt",
      });
      expect(result).toBe("File not found: /nonexistent.txt");
    });

    test("views to end of file when view_range end is -1", async () => {
      fs.createFile("/test.txt", "a\nb\nc\nd");
      const result = await tool.execute({
        command: "view",
        path: "/test.txt",
        view_range: [2, -1],
      });
      expect(result).toBe("2\tb\n3\tc\n4\td");
    });
  });

  // ---------------------------------------------------------------------------
  // create command
  // ---------------------------------------------------------------------------
  describe("create command", () => {
    test("creates a new file with content", async () => {
      const result = await tool.execute({
        command: "create",
        path: "/hello.txt",
        file_text: "hello world",
      });
      expect(result).toBe("File created: /hello.txt");
      expect(fs.readFile("/hello.txt")).toBe("hello world");
    });

    test("creates nested file with parent directories", async () => {
      const result = await tool.execute({
        command: "create",
        path: "/src/components/Button.tsx",
        file_text: "export default function Button() {}",
      });
      expect(result).toBe("File created: /src/components/Button.tsx");
      expect(fs.exists("/src")).toBe(true);
      expect(fs.exists("/src/components")).toBe(true);
      expect(fs.readFile("/src/components/Button.tsx")).toBe(
        "export default function Button() {}"
      );
    });

    test("creates file with empty content when file_text is omitted", async () => {
      const result = await tool.execute({
        command: "create",
        path: "/empty.txt",
      });
      expect(result).toBe("File created: /empty.txt");
      expect(fs.readFile("/empty.txt")).toBe("");
    });

    test("returns error for already existing file", async () => {
      fs.createFile("/test.txt", "original");
      const result = await tool.execute({
        command: "create",
        path: "/test.txt",
        file_text: "new content",
      });
      expect(result).toBe("Error: File already exists: /test.txt");
      expect(fs.readFile("/test.txt")).toBe("original");
    });
  });

  // ---------------------------------------------------------------------------
  // str_replace command
  // ---------------------------------------------------------------------------
  describe("str_replace command", () => {
    test("replaces a single occurrence", async () => {
      fs.createFile("/test.txt", "hello world");
      const result = await tool.execute({
        command: "str_replace",
        path: "/test.txt",
        old_str: "world",
        new_str: "there",
      });
      expect(result).toContain("Replaced 1 occurrence(s)");
      expect(fs.readFile("/test.txt")).toBe("hello there");
    });

    test("replaces all occurrences", async () => {
      fs.createFile("/test.txt", "foo foo foo");
      const result = await tool.execute({
        command: "str_replace",
        path: "/test.txt",
        old_str: "foo",
        new_str: "bar",
      });
      expect(result).toContain("3");
      expect(fs.readFile("/test.txt")).toBe("bar bar bar");
    });

    test("replaces with empty string (deletion)", async () => {
      fs.createFile("/test.txt", "hello world");
      const result = await tool.execute({
        command: "str_replace",
        path: "/test.txt",
        old_str: " world",
        new_str: "",
      });
      expect(result).toContain("Replaced");
      expect(fs.readFile("/test.txt")).toBe("hello");
    });

    test("returns error when string not found", async () => {
      fs.createFile("/test.txt", "hello world");
      const result = await tool.execute({
        command: "str_replace",
        path: "/test.txt",
        old_str: "notfound",
        new_str: "bar",
      });
      expect(result).toContain("Error");
      expect(result).toContain("notfound");
    });

    test("returns error for non-existent file", async () => {
      const result = await tool.execute({
        command: "str_replace",
        path: "/nonexistent.txt",
        old_str: "foo",
        new_str: "bar",
      });
      expect(result).toContain("Error");
    });

    test("returns error for directory path", async () => {
      fs.createDirectory("/src");
      const result = await tool.execute({
        command: "str_replace",
        path: "/src",
        old_str: "foo",
        new_str: "bar",
      });
      expect(result).toContain("Error");
    });

    test("replaces multiline content", async () => {
      fs.createFile("/test.tsx", "function Foo() {\n  return <div>old</div>;\n}");
      const result = await tool.execute({
        command: "str_replace",
        path: "/test.tsx",
        old_str: "return <div>old</div>;",
        new_str: "return <div>new</div>;",
      });
      expect(result).toContain("Replaced");
      expect(fs.readFile("/test.tsx")).toContain("<div>new</div>");
    });
  });

  // ---------------------------------------------------------------------------
  // insert command
  // ---------------------------------------------------------------------------
  describe("insert command", () => {
    test("inserts text after specified line", async () => {
      fs.createFile("/test.txt", "line1\nline2\nline3");
      const result = await tool.execute({
        command: "insert",
        path: "/test.txt",
        insert_line: 1,
        new_str: "inserted",
      });
      expect(result).toBe("Text inserted at line 1 in /test.txt");
      expect(fs.readFile("/test.txt")).toBe("line1\ninserted\nline2\nline3");
    });

    test("inserts at line 0 (prepends)", async () => {
      fs.createFile("/test.txt", "line1\nline2");
      const result = await tool.execute({
        command: "insert",
        path: "/test.txt",
        insert_line: 0,
        new_str: "first",
      });
      expect(result).toBe("Text inserted at line 0 in /test.txt");
      expect(fs.readFile("/test.txt")).toBe("first\nline1\nline2");
    });

    test("inserts at last line (appends)", async () => {
      fs.createFile("/test.txt", "line1\nline2");
      const result = await tool.execute({
        command: "insert",
        path: "/test.txt",
        insert_line: 2,
        new_str: "last",
      });
      expect(result).toBe("Text inserted at line 2 in /test.txt");
      expect(fs.readFile("/test.txt")).toBe("line1\nline2\nlast");
    });

    test("returns error for out-of-range line number", async () => {
      fs.createFile("/test.txt", "line1\nline2");
      const result = await tool.execute({
        command: "insert",
        path: "/test.txt",
        insert_line: 10,
        new_str: "text",
      });
      expect(result).toContain("Error");
      expect(result).toContain("10");
    });

    test("returns error for non-existent file", async () => {
      const result = await tool.execute({
        command: "insert",
        path: "/nonexistent.txt",
        insert_line: 0,
        new_str: "text",
      });
      expect(result).toContain("Error");
    });

    test("uses insert_line 0 as default when omitted", async () => {
      fs.createFile("/test.txt", "line1");
      const result = await tool.execute({
        command: "insert",
        path: "/test.txt",
        new_str: "prepended",
      });
      expect(result).toContain("Text inserted at line 0");
    });
  });

  // ---------------------------------------------------------------------------
  // undo_edit command
  // ---------------------------------------------------------------------------
  describe("undo_edit command", () => {
    test("returns unsupported error message", async () => {
      const result = await tool.execute({
        command: "undo_edit",
        path: "/test.txt",
      });
      expect(result).toContain("undo_edit command is not supported");
    });

    test("suggests using str_replace instead", async () => {
      const result = await tool.execute({
        command: "undo_edit",
        path: "/any.txt",
      });
      expect(result).toContain("str_replace");
    });
  });
});
