# Course files

A Study course is one JSON file. A person can write it by hand, and the lesson
editor writes the same files. Moves use ordinary chess notation (SAN, such as
`Nf3`, `O-O`, `exd5`), and each step carries on from the position the previous
step reached, so a file never repeats the game so far.

`backend/trainer/study_lessons/course_files.py` reads and writes the format.
Loading a file produces the validated course model that lessons, saved
sessions and content hashes use, so every rule in
[Study](STUDY.md#reviewing-authored-course-quality) still applies.

## A small course

```json
{
  "format": "fieldwork-course-1",
  "id": "first-steps",
  "revision": "2026-10-11",
  "title": "First steps",
  "description": "Take the center and develop.",
  "side": "white",
  "topic": "opening",
  "credits": [{ "text": "Written by our club." }],
  "lines": [
    { "id": "main", "title": "Main line", "moves": "e4 e5 Nf3 Nc6 Bc4", "repertoire": true }
  ],
  "chapters": [
    {
      "id": "center",
      "title": "Take the center",
      "steps": [
        { "id": "intro", "title": "The center", "text": "Pawns in the center give your pieces room.",
          "squares": ["d4", "e4", "d5", "e5"] },
        { "id": "push", "title": "Push the e-pawn", "text": "Move your e-pawn two squares.",
          "move": "e4", "reply": "e5", "hint": "Move the pawn from e2 to e4.",
          "feedback": "Black answers in the center too." },
        { "id": "develop", "title": "Develop", "text": "Watch both knights come out.",
          "show": "Nf3 Nc6" },
        { "id": "bishop", "title": "Aim at f7", "move": "Bc4", "arrows": ["c4-f7"] },
        { "id": "rehearse", "title": "Play it from memory", "rehearse": "main" }
      ]
    }
  ]
}
```

## Course fields

| Field | Meaning |
|---|---|
| `format` | Always `fieldwork-course-1`. |
| `id` | Stable name in lowercase with hyphens. Saved progress is keyed by it. |
| `revision` | Change it whenever the content changes; members keep the revision they started. |
| `title`, `description` | Shown in Study. |
| `side` | `white` or `black`: the side the learner plays. |
| `topic` | `opening` (default) or `skills`; decides the Study section. |
| `credits` | At least one `{ "text", "url"?, "license"? }`. |
| `lines` | Lines to replay from memory: `id`, `title`, `moves`, optional `repertoire`, `eco`, `fen` and `position` (moves played before the line starts). |
| `games` | Source games for excerpts: `id`, `title`, `moves`, `credits`, optional `notes` (`ply`, `text`, `squares`, `arrows`), `fen` and `position`. |
| `chapters` | Each has `id`, `title`, `steps` and optional `entry` (the first step, if it is not the first one listed). |

## Steps

Every step has an `id` and a `title`, and may have `text`, `squares` (such as
`"e4"`) and `arrows` (such as `"c3-d5"`). Its kind comes from the field it uses:

| Kind | Field | What happens |
|---|---|---|
| Explanation | none | The learner reads and continues. |
| Demonstration | `show`: moves | The app plays the moves. |
| Decision | `move`, optional `reply`, `hint`, `feedback` | The learner must find `move`; the app answers with `reply`. |
| Decision with several right answers | `choices`: list of `{ "move", "reply"?, "feedback"?, "next"? }` | Any listed move is accepted, and each can lead somewhere else. |
| Side trip | `branch`: step id | The learner may enter a side trip that starts at that step and return to this one. |
| Game excerpt | `game`, `from`, `to` (plies) | Plays part of a source game. |
| Rehearsal | `rehearse`: line id | The learner replays the whole line from memory. |

Decisions always belong to the learner's side: it must be the learner's turn.

### Where each step starts

A step needs no position. It starts where the first step leading to it (in
file order) finished:

- the first step of a chapter starts from the initial position;
- a rehearsal starts where its line starts, and a game excerpt where its game
  reaches `from`;
- otherwise it starts where the earlier step that leads to it ended: after a
  demonstration's moves, or after a decision's move and reply.

Give a step `position` (moves from the start, such as `"e4 e5 Nf3"`) and, for
a different starting position, `fen`, when it begins somewhere else: a separate
example, or a step nothing leads to. A side trip's own steps usually need no
position because the side-trip step leads to its first step.

### Where each step goes

`next` defaults to the step listed after it. Write `"next": "step-id"` to jump
elsewhere and `"next": null` to end there; the last step of a side trip ends
with `null` so the learner returns. In a decision with `choices`, each choice
has its own `next`.

## Checks when a file loads

Loading names the chapter and step of the first problem it finds: an illegal
or ambiguous move, an unknown field, a link to a missing step, a step that
cannot be reached, a loop, a decision on the opponent's turn, positions that do
not connect, or a rehearsal of a missing line. A course with any problem is not
offered in Study.

These checks prove that a course plays; they do not prove that it teaches good
chess. Check the taught moves with an engine and the explanations against the
board, as [Study](STUDY.md#reviewing-authored-course-quality) describes.

## Lesson editor

Administrators can write and change courses in the app: *New course* on the
Lessons page, or *Edit course* on any course page. Editing a built-in course
saves a club copy that replaces it.

- The board on the left shows where the selected step starts (or ends). The
  form on the right edits the course details, chapters, steps and the lines to
  remember.
- *Record on the board* fills a demonstration's moves, a decision's move and
  reply, or a step's own starting position by playing the moves; the server
  supplies the legal moves.
- The course is checked shortly after every change. The first problem is shown
  above the form, and steps keep their boards while another step is unfinished.
- *Save course* writes the course file into the club's courses folder. The
  editor edits the file itself, so anything it does not show (source games, a
  decision with several accepted moves) is kept unchanged; edit those in the
  file.

## Club courses

A club's own courses live in a `courses` folder beside the database
(`/data/courses` in the Docker image), or in `COURSES_PATH` when it is set.
That folder is on the same volume as the database, so club courses survive
updates and are backed up with it.

- **Everyone** can download any course from its course page with *Download
  course file*.
- **Administrators** (and the single user of a local install without accounts)
  can import a course file from the Lessons page and delete a club course from
  its course page. The first administrator is created with
  `python -m trainer.accounts create-admin YOUR_USERNAME` (see [Accounts](ACCOUNTS.md)).
- A file dropped into the folder by hand appears on the next visit to Lessons.
  A file that cannot be loaded is listed, with its problem, to administrators
  only; members never see a broken course.
- A club course with the same `id` as a built-in course replaces it. Deleting
  the club file brings the built-in course back.
- Saving or importing a course whose content changed but whose `revision` is
  already installed gives it a new revision (today's date). Members who started
  the earlier revision keep the version they began; their progress is keyed by
  revision.
