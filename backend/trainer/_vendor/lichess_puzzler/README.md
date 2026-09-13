# Lichess puzzler source

Source: https://github.com/ornicar/lichess-puzzler
Pinned commit: 8d9faff694ba3a8598abc5465347209af3f90a82
License: AGPL-3.0, complete original text in LICENSE.
Upstream authors retain copyright; see the linked repository history.

cook.py, util.py and model.py are copied from upstream. Local changes to cook.py:
package-relative imports; removal of process-wide logging setup; calls to the
Fieldwork witness observer around predicate return expressions. The observer
returns the original value unchanged. No chess conditions are broadened or tuned.
The observer records local context only for a caller that requests witnesses.

UPSTREAM.json preserves original file hashes and every original function AST hash.
Tests remove observer wrappers and compare the original function hashes; parity
tests compare all selected predicate outputs with the unwrapped source.
Keep this source's formatting intact; project Ruff excludes this vendor directory.
See docs/LICHESS_REUSE.md for application boundaries and combined-distribution terms.
