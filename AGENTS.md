# Development workflow

The project owner requires commits throughout development.

- Commit each completed, verified unit of work as you go. Do not accumulate several finished milestones in the working tree for one eventual commit.
- Use coherent, descriptive commits, with validation appropriate to the change. Do not fabricate intermediate commits for work already completed as one combined change.
- Before ending an implementation turn, commit the completed work unless the user explicitly requests otherwise. Preserve unrelated existing changes and keep them out of your commit unless the user authorizes including them.
- Push when the user requests it; committing locally and publishing to the remote are separate actions.
- Keep secrets, private PGNs, databases, backups, generated analysis reports, native binaries, and dependency folders out of commits. Update living documentation when behavior or architecture changes.
