# Contributing to Awesome AI

## Development Setup

```bash
# Clone the repo
git clone <repo-url>
cd awesome-ai

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test
```

## Making Changes

### Adding a Changeset

When you make changes that should be released, add a changeset:

```bash
pnpm changeset
```

This will prompt you to:
1. Select which packages changed (`awesome-ai`, `awesome-ai-tui`)
2. Choose the version bump type (patch, minor, major)
3. Write a summary of the changes

The changeset file is committed with your PR.

## Release Process

The repo uses **prerelease mode** for beta versions. Versions increment like `0.1.0-beta.0`, `0.1.0-beta.1`, etc.

### Automatic Beta Releases

When PRs with changesets are merged to `main`:
1. The changesets action creates a "Version Packages" PR
2. Merging that PR publishes beta versions to npm

Install beta versions with:

```bash
npm install awesome-ai@beta
```

### Stable Releases (Maintainers)

To release a stable version:

1. Go to **Actions** → **Release Stable**
2. Click **Run workflow**
3. A PR will be created that exits beta mode
4. Review and merge the PR
5. Stable versions are published to npm
6. The repo automatically re-enters beta mode

### Manual Release Commands

#### Enter Beta Mode (Initial Setup)

```bash
pnpm changeset pre enter beta
```

#### Create and Publish Beta

```bash
# Create a changeset
pnpm changeset

# Bump versions (creates X.Y.Z-beta.N)
pnpm changeset version

# Build and publish
pnpm build
pnpm changeset publish --tag beta
```

#### Release Stable Version

```bash
# Exit beta mode
pnpm changeset pre exit

# Bump to stable versions
pnpm changeset version

# Build and publish
pnpm build
pnpm changeset publish

# Re-enter beta mode for continued development
pnpm changeset pre enter beta
```

## Adding to the Registry

### Adding a New Agent

1. Create the agent in `packages/registry/src/agents/`
2. Create the corresponding prompt in `packages/registry/src/prompts/`
3. Run `pnpm build:registry` to generate the JSON files
4. Test with `awesome-ai add <agent-name>`

### Adding a New Tool

1. Create the tool in `packages/registry/src/tools/`
2. Run `pnpm build:registry`
3. Test with `awesome-ai add <tool-name> --tool`

## Code Style

This project uses [Biome](https://biomejs.dev/) for formatting and linting:

```bash
pnpm format
```

## Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests for a specific package
pnpm --filter awesome-ai test
```

