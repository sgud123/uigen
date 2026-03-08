# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server (Turbopack)
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Run tests with Vitest
npm run setup        # Install deps + generate Prisma client + run migrations
npm run db:reset     # Reset DB and re-run migrations
```

Run a single test file: `npx vitest run src/__tests__/jsx-transformer.test.ts`

## Environment

Requires a `.env` file with `ANTHROPIC_API_KEY`. The app runs without auth (anonymous mode) but projects only persist for authenticated users.

## Architecture

UIGen is an AI-powered React component generator. The user describes a component in chat, Claude generates/edits files using tools, and the result renders live in an iframe.

### Core Data Flow

1. User prompt → `ChatInterface` → `POST /api/chat` (with serialized virtual file system)
2. API route streams Claude responses; Claude calls `str_replace_editor` / `file_manager` tools
3. Tools mutate the `VirtualFileSystem` held in `FileSystemContext`
4. `FileSystemContext` triggers a refresh counter → `PreviewFrame` re-renders
5. `JSXTransformer` transpiles TSX via Babel standalone, resolves third-party imports via `esm.sh` CDN, and produces an `srcdoc` blob for the iframe
6. On stream completion, the project (messages + file state) is saved to SQLite via Prisma

### Key Modules

| Module | Path | Role |
|---|---|---|
| `VirtualFileSystem` | `src/lib/file-system.ts` | In-memory FS; no disk I/O. Serialized as JSON for API requests and DB storage. |
| `FileSystemContext` | `src/lib/contexts/file-system-context.tsx` | React context wrapping VirtualFileSystem; processes AI tool calls; drives refresh. |
| `ChatContext` | `src/lib/contexts/chat-context.tsx` | Wraps Vercel AI SDK `useChat`; manages messages and streaming state. |
| `/api/chat` | `src/app/api/chat/route.ts` | Streams Claude responses with tool support; uses Anthropic prompt caching. |
| AI Tools | `src/lib/tools/` | `str_replace_editor` (create/read/edit files) and `file_manager` (rename/delete). Both operate on VirtualFileSystem. |
| `JSXTransformer` | `src/lib/transform/jsx-transformer.ts` | Babel-transpiles TSX, builds import maps for esm.sh, inlines CSS, generates srcdoc HTML. |
| `PreviewFrame` | `src/components/preview/PreviewFrame.tsx` | Renders components in an isolated iframe via `srcdoc`; auto-detects entry points. |
| Auth | `src/lib/auth.ts` | JWT sessions (7-day), bcrypt password hashing; middleware guards project routes. |

### Layout

Three-panel layout in `src/app/main-content.tsx`:
- **Left (35%)**: Chat interface
- **Right (65%)**: Resizable split between live preview iframe and Monaco code editor + file tree

### Database

SQLite via Prisma. Two models: `User` and `Project`. `Project.messages` and `Project.data` are stored as JSON blobs (serialized chat history and VirtualFileSystem state).

### Import Resolution in Preview

The JSX transformer maps `import X from 'some-pkg'` to `https://esm.sh/some-pkg` and inserts `@/` alias support for local files. Missing imports get stub placeholder modules to prevent crashes.
