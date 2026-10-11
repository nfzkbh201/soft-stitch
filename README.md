# Soft Stitch

A gentle embroidery focus timer by [Noor Zeb Khan](https://github.com/nfzkbh201). Pick a pattern, make a little time, and watch your session turn into a stitched keepsake.

[Open Soft Stitch](https://nfzkbh201.github.io/soft-stitch/)

![Soft Stitch studio with a cherry embroidery and focus timer](docs/studio.png)

## What it does

- Six pattern families: cherries, a ribbon bow, a bouquet, strawberries, personal initials, and twelve birth flowers.
- Directional long-and-short stitches, textured floss, and a needle that lifts and pulls the thread through each stitch.
- Rose, cornflower, and peach palettes, plus custom petal, accent, and leaf colours.
- Custom focus sessions, pause/resume, and recovery after a refresh.
- A short animation preview that does not count as a focus session.
- A personal collection of finished embroideries and downloadable PNG keepsakes.
- A patchwork calendar with daily pieces and monthly/weekly focus totals.
- A mini timer with the same pause/resume controls, optionally always on top.
- Optional 5-, 10-, or 15-minute breaks, completion sound, and browser notifications.
- Collection backup/import, reduced-motion support, and responsive layouts.

Built with HTML, CSS, vanilla JavaScript, and the Canvas 2D API. No frameworks or paid services are required.

## Start

Open `dist/index.html` in a browser. No install, account, API key, or build step is needed. All scripts and icons are local.

Choose a pattern, select a thread palette, and set a focus session from 1 to 180 minutes. Initials accept one to three letters, A-Z. Birth flowers have a month selector; custom threads have three colour swatches. Preview stitches plays a short sample without starting or saving a focus session. Start, pause, resume, and reset work independently of the preview.

The needle follows actual individual stitch segments drawn on a textured fabric canvas. The timer uses a saved deadline, so refreshing or temporarily leaving the tab does not lose elapsed time. A session completes when the tab next runs if the browser was sleeping or closed. It cannot play its optional chime while the browser is closed.

Finished pieces retain the initials, month, and exact colours chosen for that session. Existing v1 sessions and pieces migrate automatically; there is no longer a 365-piece limit. Browser storage limits still apply. There are no analytics or remote font/image requests.

## Little rituals

The header's mini-window icon opens an always-on-top companion when the browser supports [Document Picture-in-Picture](https://developer.chrome.com/docs/web-platform/document-picture-in-picture). Otherwise it opens a regular small browser window, which is not always on top. Keep the studio tab open; the mini window shares its timer, closes when the studio closes, and does not create a separate session.

Session settings offer an optional break after a finished piece. Breaks only start when selected, never save a second embroidery, and return to the previous focus duration. Notifications require permission through the settings toggle and a supported secure browser. They are local notifications, not push notifications: a closed tab or sleeping device cannot deliver an on-time alert. Sound must be enabled and permitted by the browser.

## Your collection

Switch between Pieces and Patchwork in My collection. Calendar days use the device's local timezone and Monday-first weeks. Choose a day to see all its pieces; the weekly total is the current week, while the monthly total follows the visible month. Empty days are simply empty, with no streak penalties.

Export a JSON backup with the collection download icon, and import it with the upload icon. Imports merge by session ID and keep existing pieces unchanged. Invalid backups are rejected as a whole. Each import accepts up to 10,000 pieces and 8 MB. PNG exports are pictures, not restorable backups.

Storage is not synced across devices or between a local file and the hosted site. Clearing browser data removes the collection; export a backup first. A backup includes session notes, so share it only if you are comfortable sharing those notes.

## Files

- `dist/index.html`: the studio and collection views.
- `dist/style.css`, `dist/extras.css`: responsive studio, calendar, settings, and mini-window styling.
- `dist/data.js`: pattern metadata, collection validation, backup merging, and local calendar dates.
- `dist/timer.js`: deadline-based timer state and validation.
- `dist/embroidery.js`: deterministic stitch patterns, fabric, and hoop rendering.
- `dist/app.js`: controls, persistence, calendar, exports, mini window, and notifications.
- `dist/assets/`: favicon and vendored Lucide icons, with their license.

## Verification

Run `node --test tests/*.test.cjs` for timer, migration, break, backup, and calendar tests.

`tests/browser.cjs` uses Playwright and pngjs from your Node environment. Set `CHROME_PATH` to a local Chrome executable (defaults to the standard macOS path), then run `node tests/browser.cjs`. It uses an isolated browser profile and synthetic collection data. Screenshots and exports go in ignored `.qa/`. Browser checks cover all pattern families, twelve flower geometries, animation pixels, personalised pause/reload recovery, focus/break completion, PNG and JSON exports, idempotent imports, native Picture-in-Picture, the regular-window fallback, notification logic with a mocked permission API, and six viewport widths. OS-level notification delivery still depends on browser and system settings.

## Deployment

GitHub Actions runs the timer tests and JavaScript syntax checks, then publishes `dist/` to GitHub Pages on pushes to `main`. The repository's Pages source is **GitHub Actions**.

## Credits

Inspired by the playful utility of [Nashallery's Study Soda](https://nashallery.com/). The embroidery patterns, canvas rendering, and interface were created for this project. Icons are from [Lucide](https://lucide.dev/); the vendored license is included in `dist/assets/lucide-LICENSE`.

Birth-flower choices follow the primary or alternate flowers in [The Old Farmer's Almanac's monthly list](https://www.almanac.com/content/birth-month-flowers-and-their-meanings). These are stylised embroidery motifs, not botanical illustrations. Flower traditions vary; July uses water lily, August poppy, and October cosmos.
