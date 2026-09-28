# Pinned Maia-3 inference primitives

Unmodified `models.py`, `dataset.py`, `utils.py` and `__init__.py` from CSSLab/maia3
commit `1e13597c42d4858b7cfd7cfdae01e297263364b2`, under the included AGPL-3.0
license. Original source: https://github.com/CSSLab/maia3/tree/1e13597c42d4858b7cfd7cfdae01e297263364b2/maia3

The production adapter only uses the architecture, tokenizer and move vocabulary.
UCI sampling, its compatibility centipawn score, its human WDL and model download
helpers are not vendored or used. Original source hashes and checkpoint provenance
are in `trainer/human_models/manifest.json`. The supported weight preset is 79M;
weights are explicitly acquired into the installation's persistent data directory.
See `docs/MAIA_FEASIBILITY.md` for terms, CPU/CUDA benchmarks and domain limits.
