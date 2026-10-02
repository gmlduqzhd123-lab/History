# Pretendard

The app serves the unmodified Pretendard Variable v1.3.9 font locally so the same
Korean and Latin typography is available on every device and offline.

- Project: https://github.com/orioncactus/pretendard
- Release: `v1.3.9`
- Source commit: `5c41199ea0024a9e0b2cb31735265056e5472d76`
- Original font: https://raw.githubusercontent.com/orioncactus/pretendard/v1.3.9/packages/pretendard/dist/web/variable/woff2/PretendardVariable.woff2
- SHA-256: `9599f12fd42fc0bce1cd50b47a0c022e108d7aa64dd0d1bb0ed44f3282d900b4`
- License: SIL Open Font License 1.1; the original notice is included in [OFL.txt](OFL.txt).

The CSS family name `Pretendard` refers to this variable font. Its native weight
range is 45–920. The font is preloaded by `index.html` and included in the versioned
service-worker cache. No external font service is needed at runtime.

## Noto Serif KR — introduction-page typography

The introduction uses Noto Serif KR for larger, traditional Korean lettering.
Learning screens continue to use Pretendard.

- Official Google Fonts source: https://github.com/google/fonts/tree/9710da1eacb3be272583c3224dcb70f9da6eadbb/ofl/notoserifkr
- Original TTF: https://raw.githubusercontent.com/google/fonts/9710da1eacb3be272583c3224dcb70f9da6eadbb/ofl/notoserifkr/NotoSerifKR%5Bwght%5D.ttf
- Upstream: https://github.com/notofonts/noto-cjk/tree/985fa52c81c1d6692ccdd82bc3656e8fb932fd89
- Version: `2.003-H1`
- Original TTF SHA-256: `11f8d5de6f1b79195efba3828aaa2ec95c1178f5ae976fb23c8d53250a9938f3`
- Webfont SHA-256: `e873199ed8f2a76e32c7239e877c6d0e89ed06d0df73bc4d718e3ddd05c2fa00`
- Webfont size: 5,859,208 bytes.
- License: SIL Open Font License 1.1; the original Google Fonts license is included verbatim in [NotoSerifKR-OFL.txt](NotoSerifKR-OFL.txt), and the embedded Adobe copyright notice is retained in the font.

`NotoSerifKRVariable.woff2` is a format conversion of the official TTF using
fontTools and Brotli, without subsetting. All 24,910 glyphs, including all 11,172
modern Hangul syllables, are retained so student names are not limited to the
initial page text. Character mappings, outlines, hinting, horizontal and vertical
metrics, variation tables and layout tables are identical to the original. Only
the format-dependent checksum and WOFF2 conversion flag in `head` differ; source
timestamps and naming metadata are preserved. The conversion used fontTools
4.61.1 and Brotli 1.2.0 with `TTFont(..., recalcTimestamp=False)`.

The CSS family name is `Noto Serif KR`. Its native variable weight range is
200–900, allowing substantial text weights without synthetic bold. It is served
locally and included in the versioned service-worker cache; no external font
service is needed at runtime.
