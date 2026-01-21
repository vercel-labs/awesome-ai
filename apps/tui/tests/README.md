# TUI Tests

This folder contains Bun-based tests for the TUI app.

## Prerequisites
- Bun installed and available in PATH.

## Run all tests
From the TUI app directory:

```sh
bun test
```

Or from the repo root:

```sh
bun test --cwd apps/tui
```

## Run a single test file

```sh
bun test tests/rendering/markdown.test.tsx
```

## Notes
- Tests use OpenTUI's test renderer for headless TUI rendering.
