# Lichess accuracy port

Python translation of the published Lichess accuracy implementation, added
September 26, 2026. Upstream authors: the Lichess contributors and Thibault Duplessis.

Pinned references:

- [lila AccuracyPercent.scala](https://github.com/lichess-org/lila/blob/2e653ad1e2b9fad31b4a092394019ef8fafdedb8/modules/analyse/src/main/AccuracyPercent.scala)
  and its sibling test suite, AGPL-3.0. Full license: LICENSE.lila.
- [scalachess eval.scala](https://github.com/lichess-org/scalachess/blob/a90c6dd1c14095566cb7239f4e7f461bf88a13d3/core/src/main/scala/eval.scala),
  version 17.8.2, MIT. Full license: LICENSE.scalachess.
- [scalalib Maths.scala](https://github.com/lichess-org/scalalib/blob/cc3cda325ec21cd33a611c8887e561ad266df64e/lila/src/main/scala/Maths.scala),
  version 11.8.8, MIT. Full license: LICENSE.scalalib.

These are the dependency versions declared by the pinned lila revision. The port
retains the numerical constants, uncertainty allowance, population deviation,
window alignment and bounds, harmonic denominator floor, and two-player requirement.
Local modifications: Python data structures and an optional initial White evaluation
for games imported from a custom starting position. The normal starting value is
unchanged at +15 centipawns. Fieldwork's adapter handles typed mate outcomes and
complete-review validation outside this module.

No Scala runtime, external service, or new engine search is needed. Score inputs
come from Fieldwork's engine, so results need not equal a separately analyzed game
on lichess.org.
