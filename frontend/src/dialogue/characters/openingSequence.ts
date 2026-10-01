/** Whole authored sentences for the shared recognition/sequence meanings.
 * Neither recognition nor a consecutive run says that these moves were good. */
export const storytellerOpeningTemplates = {
  "book-opening-entry-1": ["Familiar territory here: this move belongs to {opening}."],
  "book-opening-entry-2": ["We have an opening match for this move: {opening}."],
  "book-opening-entry-3": ["This move has a place in the opening record, under {opening}."],
  "book-opening-follow-1": ["We're still on a known opening path here: {opening}."],
  "book-opening-follow-2": ["This next move is in the opening record too: {opening}."],
  "book-opening-follow-3": ["The familiar sequence continues with this move in {opening}."],
  "book-opening-follow-4": ["Another move along the recorded opening path: {opening}."],
  "book-opening-follow-5": ["The opening record still has a match here, under {opening}."],
  "book-opening-follow-6": ["This move also belongs to the known opening sequence: {opening}."],
  "book-opening-follow-7": ["We're following recorded opening moves here; this one is listed under {opening}."],
  "book-opening-follow-8": ["The next step is recognized as well, in {opening}."],
} as const;

export const robotOpeningTemplates = {
  "book-opening-entry-1": ["Opening match: {opening}."],
  "book-opening-entry-2": ["This move is in the opening record: {opening}."],
  "book-opening-entry-3": ["Recognized opening move. The entry is {opening}."],
  "book-opening-follow-1": ["Another opening match: {opening}."],
  "book-opening-follow-2": ["Sequence status: recognized. Current entry: {opening}."],
  "book-opening-follow-3": ["Opening recognition continues here: {opening}."],
  "book-opening-follow-4": ["Next reviewed move, another match: {opening}."],
  "book-opening-follow-5": ["Recorded opening move confirmed: {opening}."],
  "book-opening-follow-6": ["This move also matches the opening record: {opening}."],
  "book-opening-follow-7": ["The sequence continues through a recognized move in {opening}."],
  "book-opening-follow-8": ["Opening match maintained with this move: {opening}."],
} as const;
