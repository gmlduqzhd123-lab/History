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

## Gaegu — introduction-page headings

The introduction uses Gaegu Bold for friendly handwritten headings and buttons.
Long descriptions and learning screens continue to use Pretendard.

- Designer: JIKJI SOFT
- Official source: https://github.com/google/fonts/tree/088df5c822dacc8fad9dd64dbbe5649cd6830e99/ofl/gaegu
- Original TTF SHA-256: `cc38a4af9506a45254d1ce07c589ec473d9e5f0be319e5a77b17c214903f8c1c`
- Webfont SHA-256: `f3fcd4a32e9f56e17ca004f2154973208a7947ec934365e1cec979f7ce77bff1`
- License: SIL Open Font License 1.1, included in [Gaegu-OFL.txt](Gaegu-OFL.txt).

`gaegu-bold.woff2` is a format conversion of the official TTF using fontTools and
Brotli, without subsetting. All 2,594 glyphs, character mappings, outlines and
horizontal metrics are identical to the original. It is included in the versioned
service-worker cache and is requested only when the introduction needs it.
