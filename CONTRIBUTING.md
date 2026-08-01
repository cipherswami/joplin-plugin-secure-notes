# Contributing

Thanks for your interest in contributing! This document covers how to set up the project, make changes, and submit them.

## Getting Started

To get started:

1. Fork the repository.

2. Create a new branch for your changes.

3. Install dependencies:

```bash
npm install
```

4. Make your changes and build the plugin:

```bash
npm run dist
```

5. To test it add this repo to Joplin development path:

  - Open Joplin → **Options → Plugins → Advanced settings**
  - Under **Development plugins**, add the path to this repo's root directory
  - Restart Joplin — it will load the plugin directly from your your code
  - Whenever you make a change run `npm run dist`, then just reload Joplin to get the change reflected

6. Once everything looks good, submit a Pull Request.

## Pull Requests

Before submitting a Pull Request:

1. Ensure there is a related issue. If it doesn't exist, create one and discuss the proposed change before starting work.

2. Keep your PR focused on a single change.

## Commit Style

Please follow the [Conventional Commits](https://www.conventionalcommits.org/) specification and sign off your commits.

Example:
```text
feat: add support for quoted strings

Add support for parsing quoted strings with escaped characters.
This improves compatibility with common configuration formats.

Signed-off-by: Jane Doe <jane.doe@example.com>
```

## Coding Style

Coding style to be followed:

1. Match the existing code style (indentation, naming conventions) rather than introducing a new one.

2. Keep functions small and focused; prefer clarity over cleverness, especially in code touching encryption logic.
