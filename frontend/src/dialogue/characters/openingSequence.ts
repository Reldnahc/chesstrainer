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

export const capybaraOpeningTemplates = {
  "book-opening-entry-1": ["All right, we are in known opening territory: {opening}."],
  "book-opening-entry-2": ["This move is part of a recorded opening, {opening}."],
  "book-opening-entry-3": ["We have an opening match here. It is listed under {opening}."],
  "book-opening-follow-1": ["Still on the known path, in {opening}."],
  "book-opening-follow-2": ["Another recorded move, and we are still in {opening}."],
  "book-opening-follow-3": ["The opening record keeps going here: {opening}."],
  "book-opening-follow-4": ["No change yet; this move is also in {opening}."],
  "book-opening-follow-5": ["We stay on familiar ground with this one, in {opening}."],
  "book-opening-follow-6": ["This next move is listed too, under {opening}."],
  "book-opening-follow-7": ["Quietly along the recorded path again: {opening}."],
  "book-opening-follow-8": ["The known sequence carries on here, in {opening}."],
} as const;

export const mushroomOpeningTemplates = {
  "book-opening-entry-1": ["Someone has walked this way before: this move belongs to {opening}."],
  "book-opening-entry-2": ["This move already has a name beside it: {opening}."],
  "book-opening-entry-3": ["Here is a move the opening record recognizes, under {opening}."],
  "book-opening-follow-1": ["Another familiar step along {opening}."],
  "book-opening-follow-2": ["The path still has footprints here, in {opening}."],
  "book-opening-follow-3": ["This one is written down too, in {opening}."],
  "book-opening-follow-4": ["Still a known step. The record follows along: {opening}."],
  "book-opening-follow-5": ["The map hasn't run out yet; this move is part of {opening}."],
  "book-opening-follow-6": ["One more move the opening record has seen before, in {opening}."],
  "book-opening-follow-7": ["The recorded path keeps winding on through {opening}."],
  "book-opening-follow-8": ["Still recognized, a little further along {opening}."],
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

export const slimeOpeningTemplates = {
  "book-opening-entry-1": ["This one's in the opening book: {opening}."],
  "book-opening-entry-2": ["We've a name for this opening: {opening}."],
  "book-opening-entry-3": ["This move comes straight from the opening book. It's part of {opening}."],
  "book-opening-follow-1": ["Still in the book, still {opening}."],
  "book-opening-follow-2": ["And another known move, in {opening}."],
  "book-opening-follow-3": ["On we go, still following {opening}."],
  "book-opening-follow-4": ["The book has this one as well: {opening}."],
  "book-opening-follow-5": ["Yep, this move's listed too, in {opening}."],
  "book-opening-follow-6": ["The opening book keeps up with us here: {opening}."],
  "book-opening-follow-7": ["Still on the known track with {opening}."],
  "book-opening-follow-8": ["Another step the book knows, in {opening}."],
} as const;
