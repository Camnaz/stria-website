# Contributing to StriaSystems

Thank you for your interest in contributing to StriaSystems! This document provides guidelines for contributing to the project.

## Getting Started

### Prerequisites

- Node.js 20+
- Rust (stable)
- Python 3.11+ (for ML components)
- Git

### Development Setup

1. Fork and clone the repository
2. Install Node.js dependencies:
   ```bash
   npm ci
   ```
3. Build the Rust core:
   ```bash
   cd trace-core && cargo build --release
   ```
4. (Optional) Set up Python environment for ML components:
   ```bash
   cd prototype/mlx-classifier && pip install -r requirements.txt
   ```

## Development Workflow

### Branching Strategy

- `main` - Production-ready code, protected branch
- `develop` - Integration branch for features
- Feature branches: `feature/<description>`
- Bug fix branches: `fix/<description>`
- Release branches: `release/<version>`

### Making Changes

1. Create a new branch from `develop` (or `main` for hotfixes)
2. Make your changes with clear, focused commits
3. Run tests and checks locally before pushing
4. Open a Pull Request against `develop`

### Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Formatting, missing semicolons, etc.
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `perf`: Performance improvement
- `test`: Adding missing tests
- `chore`: Maintenance tasks

Examples:
```
feat(frontend): add trace evidence visualization component
fix(rust): handle edge case in canonical JSON serialization
docs: update architecture decision records
```

## Testing

### Frontend (TypeScript/React)

```bash
# Type checking
npm run trace:typecheck

# Unit tests
npm run test

# Build
npm run build
```

### Rust (trace-core)

```bash
cd trace-core

# Format check
cargo fmt --all -- --check

# Linting
cargo clippy --all-targets --all-features -- -D warnings

# Tests
cargo test --all-features

# Build
cargo build --release
```

### Python (ML Components)

```bash
cd prototype/mlx-classifier

# Syntax check
python -m py_compile *.py

# Run tests (if available)
pytest -v
```

## Pull Request Process

1. Ensure all CI checks pass
2. Update documentation if needed
3. Add tests for new functionality
4. Request review from maintainers
5. Address review feedback
6. Squash and merge (maintainers will handle)

## Code Style

### TypeScript/React

- Follow the existing code style in the project
- Use TypeScript strict mode
- Prefer functional components with hooks
- Use CSS Modules for styling

### Rust

- Run `cargo fmt` before committing
- Address all `cargo clippy` warnings
- Follow Rust API guidelines

### Python

- Follow PEP 8
- Use type hints where possible

## Architecture

StriaSystems consists of:

- **Frontend**: React + TypeScript + Vite (in `src/`)
- **Core**: Rust library with N-API bindings (in `trace-core/`)
- **ML**: Python classification pipeline (in `prototype/mlx-classifier/`)
- **Runtime**: TypeScript trace runtime (in `prototype/trace-runtime/`)
- **Deployment**: Cloudflare Pages via Wrangler

## Reporting Issues

Please use the issue templates:
- [Bug Report](.github/ISSUE_TEMPLATE/bug_report.yml)
- [Feature Request](.github/ISSUE_TEMPLATE/feature_request.yml)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.