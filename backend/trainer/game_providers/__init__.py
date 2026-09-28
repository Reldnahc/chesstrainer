"""Registry shared by API discovery, validation and job dispatch."""

from dataclasses import dataclass

from trainer.game_providers.base import ProviderError


@dataclass(frozen=True)
class Provider:
    id: str
    name: str
    time_classes: tuple[str, ...]

    def validate(self, request):
        if request.time_class not in self.time_classes:
            raise ValueError(f"Unsupported {self.name} time control.")


PROVIDERS = {
    "chesscom": Provider("chesscom", "Chess.com", ("rapid", "blitz", "bullet", "daily", "all")),
    "lichess": Provider(
        "lichess",
        "Lichess",
        ("rapid", "blitz", "bullet", "ultraBullet", "classical", "correspondence", "all"),
    ),
}


def get_provider(provider):
    if provider not in PROVIDERS:
        raise ValueError("Unknown chess provider.")
    return PROVIDERS[provider]


def client_factories():
    from trainer.chesscom import ChessComClient
    from trainer.game_providers.lichess import LichessClient

    return {"chesscom": ChessComClient, "lichess": LichessClient}


__all__ = ["PROVIDERS", "ProviderError", "client_factories", "get_provider"]
