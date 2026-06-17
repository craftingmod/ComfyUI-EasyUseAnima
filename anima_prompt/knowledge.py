"""AnimaDex-only knowledge loading for ANIMA prompt correction."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

from .animadex import AnimaDexDB
from .models import TagInfo
from .normalize import lookup_key
from .ordering import ANIMA_PERSON_COUNT_TAGS

ANIMADEX_CHARACTERS_ENV = "ANIMADEX_CHARACTERS_CSV"
ANIMADEX_ARTISTS_ENV = "ANIMADEX_ARTISTS_CSV"
ANIMADEX_CHARACTER_INDEX_ENV = "ANIMADEX_CHARACTER_INDEX"
ANIMADEX_ARTIST_INDEX_ENV = "ANIMADEX_ARTIST_INDEX"

DEFAULT_CHARACTER_INDEX_NAME = "character_index.jsonl"
DEFAULT_ARTIST_INDEX_NAME = "artist_index.jsonl"
DEFAULT_ANIMADEX_IMPORT_DIR = Path("models") / "animadex" / "import"
DEFAULT_ANIMADEX_INDEX_DIR = Path("models") / "animadex" / "index"
PACKAGE_DATA_DIR = Path(__file__).resolve().parents[1] / "__animadex__"
PACKAGE_ANIMADEX_IMPORT_DIR = PACKAGE_DATA_DIR / "import"
PACKAGE_ANIMADEX_INDEX_DIR = PACKAGE_DATA_DIR / "index"


class KnowledgeBaseNotFound(FileNotFoundError):
    """Raised when no local AnimaDex data source could be resolved."""


@dataclass
class PromptKnowledgeBase:
    animadex: AnimaDexDB = field(default_factory=AnimaDexDB)

    @classmethod
    def empty(cls) -> "PromptKnowledgeBase":
        return cls()

    def lookup(self, tag: str) -> TagInfo | None:
        key = lookup_key(tag)
        if key in self.animadex.characters:
            return TagInfo(tag=key, category_path=("캐릭터",), source="animadex")
        if key in self.animadex.copyrights:
            return TagInfo(tag=key, category_path=("작품",), source="animadex")
        if key in self.animadex.artists:
            return TagInfo(tag=key, category_path=("작가",), source="animadex")
        if key in self.animadex.core_tags and key in ANIMA_PERSON_COUNT_TAGS:
            return TagInfo(tag=key, category_path=("인물", "인원수"), source="animadex_core")
        return None


def _candidate_paths(
    explicit: str | os.PathLike | None,
    env_name: str,
    default_name: str | os.PathLike,
    *,
    extra_defaults: Iterable[str | os.PathLike] = (),
) -> list[Path]:
    paths: list[Path] = []
    if explicit:
        paths.append(Path(explicit))
    env = os.environ.get(env_name)
    if env:
        paths.append(Path(env))
    cwd = Path.cwd()
    for base in (cwd, *cwd.parents):
        paths.append(base / default_name)
        for default in extra_defaults:
            paths.append(base / default)
    return paths


def _first_file(paths: Iterable[Path]) -> Path | None:
    seen: set[Path] = set()
    for path in paths:
        if path in seen:
            continue
        seen.add(path)
        if path.is_file():
            return path
    return None


def load_knowledge_base(
    *,
    animadex_characters_csv: str | os.PathLike | None = None,
    animadex_artists_csv: str | os.PathLike | None = None,
    animadex_character_index: str | os.PathLike | None = None,
    animadex_artist_index: str | os.PathLike | None = None,
    allow_missing: bool = False,
) -> PromptKnowledgeBase:
    """Load local prompt knowledge from AnimaDex CSV or JSONL index sources.

    This ComfyUI-node vendored MVP intentionally does not load a general tag DB.
    It uses only AnimaDex character/artist exports and the character core tags
    present in those exports.
    """

    character_index_path = _first_file(
        _candidate_paths(
            animadex_character_index,
            ANIMADEX_CHARACTER_INDEX_ENV,
            DEFAULT_CHARACTER_INDEX_NAME,
            extra_defaults=(
                PACKAGE_ANIMADEX_INDEX_DIR / DEFAULT_CHARACTER_INDEX_NAME,
                DEFAULT_ANIMADEX_INDEX_DIR / DEFAULT_CHARACTER_INDEX_NAME,
            ),
        )
    )
    artist_index_path = _first_file(
        _candidate_paths(
            animadex_artist_index,
            ANIMADEX_ARTIST_INDEX_ENV,
            DEFAULT_ARTIST_INDEX_NAME,
            extra_defaults=(
                PACKAGE_ANIMADEX_INDEX_DIR / DEFAULT_ARTIST_INDEX_NAME,
                DEFAULT_ANIMADEX_INDEX_DIR / DEFAULT_ARTIST_INDEX_NAME,
            ),
        )
    )
    char_csv_path = _first_file(
        _candidate_paths(
            animadex_characters_csv,
            ANIMADEX_CHARACTERS_ENV,
            "characters.csv",
            extra_defaults=(
                PACKAGE_ANIMADEX_IMPORT_DIR / "characters.csv",
                DEFAULT_ANIMADEX_IMPORT_DIR / "characters.csv",
            ),
        )
    )
    artist_csv_path = _first_file(
        _candidate_paths(
            animadex_artists_csv,
            ANIMADEX_ARTISTS_ENV,
            "artists.csv",
            extra_defaults=(
                PACKAGE_ANIMADEX_IMPORT_DIR / "artists.csv",
                DEFAULT_ANIMADEX_IMPORT_DIR / "artists.csv",
            ),
        )
    )
    if character_index_path or artist_index_path:
        animadex = AnimaDexDB.from_jsonl(
            character_index=character_index_path,
            artist_index=artist_index_path,
        )
    else:
        animadex = AnimaDexDB.from_csvs(
            characters_csv=char_csv_path,
            artists_csv=artist_csv_path,
        )
    if (
        not allow_missing
        and not animadex.characters
        and not animadex.copyrights
        and not animadex.artists
        and not animadex.core_tags
    ):
        raise KnowledgeBaseNotFound(
            "No AnimaDex prompt data found. Put character_index.jsonl and "
            "artist_index.jsonl under models/animadex/index, put CSV exports "
            "under models/animadex/import, or pass explicit paths."
        )
    return PromptKnowledgeBase(animadex=animadex)
