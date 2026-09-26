# Test fixtures

api_contract.json freezes the documented HTTP interface. It began with the September 13 interface extraction and now includes the additive full-game review endpoints.

lichess_synthetic.csv is a tiny authored fixture in the Lichess CSV shape. It contains legal fork/skewer/promotion lines, a deliberately inconsistent fork tag (SYN-MISS), an invalid FEN (SYN-BAD), and an unsupported theme. These rows test reconstruction, misses and skips. They are not Lichess puzzles, external labels or an accuracy sample. Real datasets and generated benchmark reports belong in ignored data.
