# ANIMA Prompt Correction Core

Dependency-light prompt correction helpers for ANIMA-style tag order.

This vendored copy is scoped for the ComfyUI EasyUse Anima node pack MVP. It
does not import ComfyUI, torch, model loading code, taggers, or a general tag DB.

## MVP Scope

- Danbooru-style comma-separated prompt parsing
- ComfyUI/NovelAI prompt weighting syntax preservation
- tag normalization
- AnimaDex character / copyright / artist lookup
- character core tag lookup from AnimaDex exports
- ANIMA ordering
- correction report data

## Ordering

The default ordering is:

```text
quality / meta / year / safety
-> character count / person type
-> character
-> series / copyright
-> artist
-> general or unknown tags
```

## Prompt Syntax

- Unescaped parentheses are prompt weighting syntax and are preserved, for
  example `(long_hair:1.2)`.
- Literal parentheses in tag names are rendered escaped as `\(` and `\)`.
- Commas inside unescaped parentheses are preserved inside the weighted token.
- Natural-language prompt text keeps its original casing.
- Count tags such as `1girl` are split from a preceding sentence ending when the
  source text omitted a comma after the sentence.

Example:

```text
masterpiece, best quality, newest, safe,
1girl,
hatsune miku,
vocaloid,
@artist_name,
aqua eyes, twintails, detached sleeves
```

## Data Sources

This vendored MVP uses only local AnimaDex exports or indexes:

- `characters.csv`
- `artists.csv`
- `character_index.jsonl`
- `artist_index.jsonl`

Resolution order:

1. Explicit ComfyUI node input path
2. environment variable
3. workspace-local default path

Environment variables:

- `ANIMADEX_CHARACTERS_CSV`
- `ANIMADEX_ARTISTS_CSV`
- `ANIMADEX_CHARACTER_INDEX`
- `ANIMADEX_ARTIST_INDEX`

Default local paths:

- Package-local CSV: `__easyuse_anima__/import/characters.csv`,
  `__easyuse_anima__/import/artists.csv`
- Package-local index: `__easyuse_anima__/index/character_index.jsonl`,
  `__easyuse_anima__/index/artist_index.jsonl`
- CSV: `models/animadex/import/characters.csv`,
  `models/animadex/import/artists.csv`
- Index: `models/animadex/index/character_index.jsonl`,
  `models/animadex/index/artist_index.jsonl`

`__easyuse_anima__/` and `models/animadex/` are ignored by Registry packaging.
Do not commit downloaded CSVs or tokens.

## AnimaDex Fields

Characters:

- `character`
- `copyright`
- `trigger`
- `core_tags`
- `count`
- `url`

Artists:

- `artist`
- `trigger`
- `count`
- `url`
