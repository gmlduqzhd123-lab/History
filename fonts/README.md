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

## Jua — introduction-page headings

The introduction uses Jua for thick, rounded headings and buttons.
Long descriptions and learning screens continue to use Pretendard.

- Official source: https://github.com/google/fonts/tree/69d2493f8b919292a9c4b530081934877093c038/ofl/jua
- Original TTF SHA-256: `769677aef240bfc3b9965f2b50748075bff885e6c6992fc591a3fb268279f898`
- Webfont SHA-256: `cb995145eb03afc3ca5d714471d2183f58d56ed571001321e109170b421abcda`
- License: SIL Open Font License 1.1, included in [Jua-OFL.txt](Jua-OFL.txt).

`jua-regular.woff2` is a format conversion of the official TTF using fontTools and
Brotli, without subsetting. All 2,520 glyphs, character mappings, outlines, hinting
and horizontal metrics are identical to the original. Its regular weight (400)
has naturally thick strokes; CSS does not add synthetic bold. It is included in
the versioned service-worker cache and requested when the introduction needs it.
