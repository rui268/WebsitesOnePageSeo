# SEO

## Quick Start

1. **Read CLAUDE.md first** — contains essential rules for Claude Code
2. Follow the pre-task compliance checklist before starting any work
3. Use proper module structure under `src/main/`
4. Commit after every completed task

## Project Structure

```
project-root/
├── CLAUDE.md              # Rules for Claude Code
├── README.md              # This file
├── .gitignore
├── src/
│   ├── main/
│   │   ├── core/          # Core business logic
│   │   ├── utils/         # Utility functions
│   │   ├── models/        # Data models
│   │   ├── services/      # Service layer
│   │   ├── api/           # API endpoints
│   │   └── resources/
│   │       ├── config/    # Configuration files
│   │       └── assets/    # Static assets
│   └── test/
│       ├── unit/
│       └── integration/
├── docs/
├── tools/
├── examples/
└── output/
```

## Development Guidelines

- **Always search first** before creating new files
- **Extend existing** functionality rather than duplicating
- **Use Task agents** for operations >30 seconds
- **Single source of truth** for all functionality
- Commit after each feature/task
