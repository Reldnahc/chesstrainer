"""Playing against the selected coach: a human-like bot, its level fit and game sessions."""

# The headers a game saved from Play carries.
PLAY_EVENT = "Fieldwork play"
PLAY_SITE = "Fieldwork"


def from_play(headers) -> bool:
    """A game saved from Play. Its Elo headers hold the bot's setting and the learner's
    fitted model level: conditioning values for the review, not ratings."""
    return headers.get("Site") == PLAY_SITE and headers.get("Event") == PLAY_EVENT
