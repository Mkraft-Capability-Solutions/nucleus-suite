<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Git Commit & Push Rules
- **NEVER run `git commit` or `git push` unless the USER explicitly requests it.**
- All code changes must remain local and uncommitted until the user explicitly directs you to commit or push.
- Verify everything locally (via typecheck, unit tests, build, and local preview) and report the results to the user.
