# Development workflow

The project owner requires commits throughout development.

- Commit each completed, verified unit of work as you go. Do not accumulate several finished milestones in the working tree for one eventual commit.
- Use coherent, descriptive commits, with validation appropriate to the change. Do not fabricate intermediate commits for work already completed as one combined change.
- Before ending an implementation turn, commit the completed work unless the user explicitly requests otherwise. Preserve unrelated existing changes and keep them out of your commit unless the user authorizes including them.
- Push when the user requests it; committing locally and publishing to the remote are separate actions.
- Keep secrets, private PGNs, databases, backups, generated analysis reports, native binaries, and dependency folders out of commits. Update living documentation when behavior or architecture changes.

## Frontend component reuse

- Before adding or changing UI, read [UI component reuse and standardization](docs/UI_COMPONENTS.md) and inspect the existing components and their consumers.
- Reuse or extend the existing component for the same job. Do not recreate selectors, controls, feedback, layouts or their responsive CSS in a page-specific implementation.
- Preserve semantic differences (links, commands, tabs and form choices), domain ownership and standalone development-tool boundaries. Document justified differences instead of silently creating a parallel component.
- Keep the component inventory current when shared UI changes. Proposed audit items are not implemented components or automatic authorization for a broader refactor.
