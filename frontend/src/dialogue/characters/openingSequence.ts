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

export const livingPawnOpeningTemplates = {
  "book-opening-entry-1": ["Hey, the opening book has this one: {opening}."],
  "book-opening-entry-2": ["A recognized opening move, filed under {opening}."],
  "book-opening-entry-3": ["The opening book lists this move in {opening}."],
  "book-opening-follow-1": ["Still on file. This move belongs to {opening} too."],
  "book-opening-follow-2": ["Another listed move, same opening: {opening}."],
  "book-opening-follow-3": ["The opening book is still keeping pace, in {opening}."],
  "book-opening-follow-4": ["Roll call continues: this move is listed in {opening}."],
  "book-opening-follow-5": ["Still by the book here, with {opening}."],
  "book-opening-follow-6": ["The book hasn't let go yet; this move is in {opening}."],
  "book-opening-follow-7": ["Right on schedule, this move turns up in {opening}."],
  "book-opening-follow-8": ["Listed again, still inside {opening}."],
} as const;

export const professorOpeningTemplates = {
  "book-opening-entry-1": ["This move belongs to {opening}, a line the opening book recognizes."],
  "book-opening-entry-2": ["{opening} is where the opening book files this move."],
  "book-opening-entry-3": ["Here the game follows {opening}, so it's on familiar ground for now."],
  "book-opening-follow-1": ["The next move stays within {opening}."],
  "book-opening-follow-2": ["Still {opening}, one move further along."],
  "book-opening-follow-3": ["This reply is also part of {opening}."],
  "book-opening-follow-4": ["The line of {opening} carries on with this move."],
  "book-opening-follow-5": ["We remain inside {opening} here."],
  "book-opening-follow-6": ["This move, too, is part of the recognized sequence in {opening}."],
  "book-opening-follow-7": ["{opening} lists this move as well."],
  "book-opening-follow-8": ["Still {opening}. Knowing the line tells us where the game is, which is a different thing from judging the move."],
} as const;

export const collieOpeningTemplates = {
  "book-opening-entry-1": ["Book move, logged: this is {opening}."],
  "book-opening-entry-2": ["Opening identified as {opening}."],
  "book-opening-entry-3": ["Recognized line on the board: {opening}."],
  "book-opening-follow-1": ["Next move, still {opening}."],
  "book-opening-follow-2": ["{opening}, next move on record."],
  "book-opening-follow-3": ["Reply logged in {opening} as well."],
  "book-opening-follow-4": ["On track with {opening}."],
  "book-opening-follow-5": ["Another step of {opening} confirmed."],
  "book-opening-follow-6": ["Theory holds: still {opening}."],
  "book-opening-follow-7": ["{opening} again on this move."],
  "book-opening-follow-8": ["Still tracking {opening}. That locates the game and says nothing about the move's value."],
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
  "book-opening-follow-4": ["The book's got this one too: {opening}."],
  "book-opening-follow-5": ["Yep, this move's listed too, in {opening}."],
  "book-opening-follow-6": ["The opening book keeps up with us here: {opening}."],
  "book-opening-follow-7": ["Still on the known track with {opening}."],
  "book-opening-follow-8": ["Another move straight out of {opening}."],
} as const;

export const alienOpeningTemplates = {
  "book-opening-entry-1": ["The catalogue has a name for this move: {opening}."],
  "book-opening-entry-2": ["Opening theory gives this move a name: {opening}."],
  "book-opening-entry-3": ["This move appears in the opening catalogue as {opening}."],
  "book-opening-follow-1": ["Still within opening theory: {opening}."],
  "book-opening-follow-2": ["The catalogue follows this move too, under {opening}."],
  "book-opening-follow-3": ["Opening theory knew this one as well: {opening}."],
  "book-opening-follow-4": ["The theoretical line continues: {opening}."],
  "book-opening-follow-5": ["Charted ground still, in {opening}."],
  "book-opening-follow-6": ["Once more, a move with an entry under {opening}."],
  "book-opening-follow-7": ["The game keeps tracing the documented line of {opening}."],
  "book-opening-follow-8": ["Deeper into {opening}, a move theory accounts for."],
} as const;

export const wizardOpeningTemplates = {
  "book-opening-entry-1": ["The opening literature records this move under {opening}."],
  "book-opening-entry-2": ["This move is in the book, and the position belongs to {opening}."],
  "book-opening-entry-3": ["This move is written into the theory of {opening}."],
  "book-opening-follow-1": ["The literature continues: {opening}."],
  "book-opening-follow-2": ["Another page of {opening}."],
  "book-opening-follow-3": ["The reply, too, is recorded theory in {opening}."],
  "book-opening-follow-4": ["Still on the well-trodden road of {opening}."],
  "book-opening-follow-5": ["{opening} continues along its recorded path."],
  "book-opening-follow-6": ["The book keeps an entry for this move as well, in {opening}."],
  "book-opening-follow-7": ["Still within the recorded theory of {opening}."],
  "book-opening-follow-8": ["Another recorded move of {opening}. Its place in the book is a matter of record, not a verdict."],
} as const;

export const tuxedoOpeningTemplates = {
  "book-opening-entry-1": ["This is book, filed under {opening}."],
  "book-opening-entry-2": ["Known theory here: {opening}."],
  "book-opening-entry-3": ["Theory has a name for this one: {opening}."],
  "book-opening-follow-1": ["The theory runs on: {opening}."],
  "book-opening-follow-2": ["Theory covers this one too, in {opening}."],
  "book-opening-follow-3": ["The reply comes from theory too, in {opening}."],
  "book-opening-follow-4": ["By the book, still inside {opening}."],
  "book-opening-follow-5": ["Still on known moves within {opening}."],
  "book-opening-follow-6": ["{opening} supplies another book move."],
  "book-opening-follow-7": ["No departure yet from {opening}."],
  "book-opening-follow-8": ["Theory still, in {opening}; a name, not a verdict."],
} as const;

export const raccoonOpeningTemplates = {
  "book-opening-entry-1": ["This one's a known route: {opening}."],
  "book-opening-entry-2": ["Familiar alley, and it comes with a name: {opening}."],
  "book-opening-entry-3": ["The book's got this move marked down, under {opening}."],
  "book-opening-follow-1": ["Same known route: {opening}."],
  "book-opening-follow-2": ["Covered by the book as well: {opening}."],
  "book-opening-follow-3": ["Same route, next move: {opening}."],
  "book-opening-follow-4": ["Nothing new yet; this is still {opening}."],
  "book-opening-follow-5": ["The known route keeps going through {opening}."],
  "book-opening-follow-6": ["The book still has this covered: {opening}."],
  "book-opening-follow-7": ["One more known step down {opening}."],
  "book-opening-follow-8": ["The book's not out of moves yet: {opening}."],
} as const;

export const kittenOpeningTemplates = {
  "book-opening-entry-1": ["Ooh, I know this trail! It's {opening}."],
  "book-opening-entry-2": ["Name tag on this move: {opening}."],
  "book-opening-entry-3": ["Seen it before! {opening} includes this move."],
  "book-opening-follow-1": ["The book hasn't left our side: {opening}."],
  "book-opening-follow-2": ["{opening} has this one on its pages too."],
  "book-opening-follow-3": ["Look, the reply is book too, straight out of {opening}."],
  "book-opening-follow-4": ["The trail through {opening} keeps on going."],
  "book-opening-follow-5": ["We're still inside the map of {opening}."],
  "book-opening-follow-6": ["Yet another book move from {opening}."],
  "book-opening-follow-7": ["{opening} still has more pages."],
  "book-opening-follow-8": ["The pages of {opening} keep turning; that's a map, not a report card."],
} as const;

export const dragonOpeningTemplates = {
  "book-opening-entry-1": ["The opening is known to theory: {opening}."],
  "book-opening-entry-2": ["This move stands in established theory, as {opening}."],
  "book-opening-entry-3": ["This move carries a name in theory: {opening}. A name is not a plan."],
  "book-opening-follow-1": ["Theory still holds here: {opening}."],
  "book-opening-follow-2": ["Another established move in {opening}."],
  "book-opening-follow-3": ["The game keeps to the theory of {opening}."],
  "book-opening-follow-4": ["Still within the known lines of {opening}."],
  "book-opening-follow-5": ["{opening} continues, move for move."],
  "book-opening-follow-6": ["The established line runs on: {opening}."],
  "book-opening-follow-7": ["Theory has not run out yet in {opening}."],
  "book-opening-follow-8": ["One more move that theory already knows, in {opening}."],
} as const;

export const velvetOpeningTemplates = {
  "book-opening-entry-1": ["This move is carried in the opening books, in {opening}."],
  "book-opening-entry-2": ["A move from a known opening, this: {opening}."],
  "book-opening-entry-3": ["The opening book keeps this move on its pages, under {opening}."],
  "book-opening-follow-1": ["Still the book's ground: {opening}."],
  "book-opening-follow-2": ["And this one is known, too, in {opening}."],
  "book-opening-follow-3": ["For the reply as well, {opening} has a page."],
  "book-opening-follow-4": ["Still walking the book's path, within {opening}."],
  "book-opening-follow-5": ["Here too, {opening} has a record of the move."],
  "book-opening-follow-6": ["{opening} walks along beside us here."],
  "book-opening-follow-7": ["Known, again: {opening}."],
  "book-opening-follow-8": ["Known once more, in {opening}. Being in the book says where we are, nothing more."],
} as const;

export const corgiOpeningTemplates = {
  "book-opening-entry-1": ["Straight from the manual: {opening}."],
  "book-opening-entry-2": ["This move is in the field manual, under {opening}."],
  "book-opening-entry-3": ["Recognized opening, on record as {opening}."],
  "book-opening-follow-1": ["Still following the manual: {opening}."],
  "book-opening-follow-2": ["Another move from the manual, in {opening}."],
  "book-opening-follow-3": ["The manual covers the reply as well: {opening}."],
  "book-opening-follow-4": ["The manual keeps going through {opening}."],
  "book-opening-follow-5": ["Formation holds, still within {opening}."],
  "book-opening-follow-6": ["{opening} keeps marching."],
  "book-opening-follow-7": ["The drill continues in {opening}."],
  "book-opening-follow-8": ["Manual entry again: {opening}. A listing, not a ruling."],
} as const;

export const unicornOpeningTemplates = {
  "book-opening-entry-1": ["We've stepped into a recognized opening: {opening}."],
  "book-opening-entry-2": ["A book move, part of {opening}, and a fitting one."],
  "book-opening-entry-3": ["This move has its own page in the story of {opening}."],
  "book-opening-follow-1": ["The game moves on in harmony with {opening}."],
  "book-opening-follow-2": ["And this move belongs to {opening} as well."],
  "book-opening-follow-3": ["The reply, too, keeps step with {opening}."],
  "book-opening-follow-4": ["The melody of {opening} flows onward."],
  "book-opening-follow-5": ["{opening} still recognizes this move."],
  "book-opening-follow-6": ["{opening} keeps walking alongside the game."],
  "book-opening-follow-7": ["This step, too, is written into {opening}."],
  "book-opening-follow-8": ["Once more a move of {opening}. A name in the book tells us where we are, not how well the move was chosen."],
} as const;

export const expertOpeningTemplates = {
  "book-opening-entry-1": ["Opening theory begins: {opening}."],
  "book-opening-entry-2": ["Catalogued theory move, {opening}."],
  "book-opening-entry-3": ["Theory entry on record: {opening}."],
  "book-opening-follow-1": ["{opening}: theory continues."],
  "book-opening-follow-2": ["Also catalogued under {opening}."],
  "book-opening-follow-3": ["The reply is catalogued in {opening} as well."],
  "book-opening-follow-4": ["Zero deviation so far from {opening}."],
  "book-opening-follow-5": ["Listed in {opening}."],
  "book-opening-follow-6": ["The {opening} line holds."],
  "book-opening-follow-7": ["{opening}, still catalogued."],
  "book-opening-follow-8": ["Still {opening}. Book status locates the game; it does not evaluate the move."],
} as const;
