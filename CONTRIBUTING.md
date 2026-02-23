# Contributing to thread-inbox

Thank you for your interest in contributing!

## Development Setup

```bash
git clone https://github.com/metyatech/thread-inbox.git
cd thread-inbox
npm install
```

## Workflow

1. Fork the repository and create a feature branch from `main`.
2. Make your changes.
3. Run `npm run verify` to ensure format, lint, build, and tests all pass.
4. Commit your changes with a clear message.
5. Open a pull request against `main`.

## Code Style

- TypeScript with strict mode enabled.
- Prettier for formatting (`npm run format`).
- ESLint for linting (`npm run lint`).
- Pre-commit hooks run automatically via husky + lint-staged.

## Running Tests

```bash
npm test
```

## Commit Messages

Use concise, imperative-style commit messages (e.g., `add thread archiving`, `fix storage read race`).

## Reporting Issues

Please open an issue on [GitHub Issues](https://github.com/metyatech/thread-inbox/issues).
