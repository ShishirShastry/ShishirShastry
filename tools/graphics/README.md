# Profile graphics generator

Builds the hand-made SVGs in `../../assets/`: the banner, the Evora card, the
buttons, the divider and the section headings, in dark and light.

Text is drawn as Inter's glyph outlines (SIL Open Font License), so the SVGs need no
font when GitHub shows them and look the same on every system. To change any
wording, edit the `.js` file that draws it and run the generator again; the SVGs
cannot be edited by hand.

```sh
node build.js            # everything
node build.js banner     # or: evora, small (buttons, divider, headings)
```

It needs, from the Evora repository next to this one (`F:/Open Design`):
Playwright with Microsoft Edge (to measure kerning) and the Inter font files of
`@fontsource/inter`. The paths are at the top of `textkit.js`.

The live cards (stats, languages, streak, contribution skyline) are not made
here: `scripts/cards.mjs` renders them every day on GitHub Actions
(`.github/workflows/cards.yml`) into the `output` branch.
