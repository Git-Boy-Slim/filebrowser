# Custom themes for FileBrowser Quantum

A theme is a plain CSS file – no changes to the app's code are needed.

```
themes/
├── cupertino/                macOS / iOS theme following Apple's Human Interface Guidelines
│   ├── theme.css             user theme (customThemes) – light + dark, switches live
│   ├── login.css             login page (customCSS) – only applies inside #login
│   └── config.example.yaml   example frontend.styling block for config.yaml
└── dev/
    ├── config.dev.yaml       config for a local test instance (port 8090)
    └── shot.js               Playwright: screenshots of all views (light/dark, mobile)
```

## Cupertino at a glance

- **Accent color:** the six colors of the profile color picker are redefined as Apple
  system colors. Folders, switches, selection and buttons follow the chosen color; a
  custom hex color works too (folder colors are then mixed from it).
- **Icons:** folders and file types are original vector drawings in the macOS style,
  done purely in CSS (masks keyed on the `data-type` / `data-name` attributes of listing
  items). Files with a thumbnail keep their image. In narrow lists the extension label is
  hidden and the glyph gets larger.
- **Views:** list and compact as grouped tables (folders / files), gallery and icons like
  Finder (outline only when selected), mobile as a grouped list like the iOS Files app.
- **Settings:** one continuous list of grouped tables with section headers, iOS switches
  and a segmented control with color dots; the navigation looks like the iOS Settings
  start page.
- **Login:** via `customCSS`, because the app does not know the user – and therefore no
  user theme – on the login page. The file is scoped to `#login`, so it does not affect
  the app or other themes.

## Installation

### Plain binary (no Docker)

Sync only the `themes` folder of this repository next to your `config.yaml` with a
sparse checkout. Replace `<owner>/<repo>` and `<branch>` with your fork and branch:

```bash
cd ~/.config/filebrowser-quantum        # the directory that contains config.yaml
git clone --branch <branch> --single-branch --depth 1 \
  --filter=blob:none --sparse \
  https://github.com/<owner>/<repo>.git git
git -C git sparse-checkout set themes
```

Then add the `frontend.styling` block from
[`cupertino/config.example.yaml`](cupertino/config.example.yaml) (variant A) to your
`config.yaml`:

```yaml
frontend:
  styling:
    customCSS: "./git/themes/cupertino/login.css"
    customThemes:
      default:
        description: "Default"
        css: ""
      cupertino:
        description: "Cupertino (macOS / iOS)"
        css: "./git/themes/cupertino/theme.css"
```

Relative paths are resolved from FileBrowser's **working directory**, not from the
location of `config.yaml`. They work as shown as long as FileBrowser is started from the
directory that contains `config.yaml` – e.g. a start script or cron watchdog that runs
`cd ~/.config/filebrowser-quantum` before launching the binary.

**Updating after a change:**

```bash
git -C ~/.config/filebrowser-quantum/git pull
# then restart FileBrowser the way you normally do (start script, systemd, ...)
```

FileBrowser reads the CSS files only at startup, so the restart is required. If a path is
wrong, the log shows `could not read custom CSS file: ...` and the theme is missing from
the selection – the app itself keeps working.

Optional: `themes/dev` only contains local test tooling and is never loaded. To leave it
out of the checkout:

```bash
git -C ~/.config/filebrowser-quantum/git sparse-checkout set --no-cone '/themes/' '!/themes/dev/'
```

### Docker

The official image runs in `/home/filebrowser`. Mount the themes folder and use absolute
paths (variant B in `config.example.yaml`):

```yaml
volumes:
  - ./themes:/home/filebrowser/themes:ro
```

### Selecting the theme

Profile → Theme & Language → "Choose your theme". The app reloads the page when the theme
changes; light/dark mode switches live. To make Cupertino the default for new users, set
`userDefaults.ui.customTheme: "cupertino"`.

## How theming works

**Loading** (`backend/pkg/settings/config.go`, `styling.go`)
- At startup the backend reads every file from `frontend.styling.customThemes[*].css`
  and `customCSS` with `os.ReadFile`.
- Missing, empty or > 128 KB files are skipped with a warning in the log.
- A `default` entry always exists (it is added automatically otherwise).

**Injection** (`backend/internal/web/static.go`, `frontend/public/index.html`)
- Order in the page:
  1. `<head>`: `css/variables.css` (color variables), an inline style with `--background`
     from `lightBackground` / `darkBackground`, the app CSS
  2. end of `<body>`: `customCSS` (for everyone), then `<style id="user-selected-theme">`
     with the theme selected by the user (or the share's theme)
- The theme therefore comes last and wins at equal specificity.
- User themes are only injected for logged-in users and for shares with a theme; the
  login page only gets `customCSS`.
- While an event theme (Halloween) is active, the user theme is disabled.

**Dark mode:** `frontend/src/utils/theme.js` toggles the `.dark-mode` class on `<html>`.

**Accent color:** `Layout.vue` sets `--primaryColor` as an inline style on `<html>` on load
(default: `var(--blue)`). Inline styles beat the theme, so a theme should either redefine
the picker colors (`--blue`, `--red`, `--icon-green`, `--icon-violet`, `--icon-yellow`,
`--icon-orange`) or set `--primaryColor: … !important`.

**Listing items** carry `data-dir`, `data-type` (MIME type) and `data-name`, which makes
per-type styling possible in CSS. Note that `[data-type*="xml"]` also matches Office
formats (`…openxmlformats…`) – use `$="/xml"` / `$="+xml"` instead.

### Most important variables (by usage count in the frontend)

| Variable | Purpose | Uses |
|---|---|---|
| `--primaryColor` | accent (buttons, links, selection) | 146 |
| `--textSecondary` / `--textPrimary` | text | 96 / 83 |
| `--divider` | lines, borders | 75 |
| `--borderRadius` / `--borderWidth` | rounding, border width | 70 / 38 |
| `--surfaceSecondary` / `--surfacePrimary` | cards, items, hover | 50 / 26 |
| `--background` / `--alt-background` | page / header & panels | 36 / 15 |
| `--hoverOverlay`, `--overlay`, `--panel-bg`, `--panel-blur` | states, glass effect | |
| `--icon-*` | file type icon colors | |

Sources: `frontend/public/css/variables.css` (light/dark colors),
`frontend/src/css/_variables.css` (shape, shadows, icons).

## Developing a theme locally

Requirements: Node 22 and Go (the module requires Go 1.27; with `GOTOOLCHAIN=auto` Go
downloads the matching version itself).

```bash
# 1. Build the frontend (ends up in backend/internal/web/embed)
cd frontend && npm ci && npm run build && cd ..

# 2. Build the backend
cd backend && GOTOOLCHAIN=auto go build -o ../themes/dev/filebrowser . && cd ..

# 3. Start the test instance (from themes/dev, because of the relative paths)
cd themes/dev && mkdir -p files && ./filebrowser -c config.dev.yaml
# → http://localhost:8090, login admin / admin1234 (local test credentials only)

# 4. Screenshots (second terminal)
node themes/dev/shot.js themes/dev/shots
```

Faster iteration without restarting: `shot.js` can inject the CSS files directly into the
page and optionally capture only some views:

```bash
node themes/dev/shot.js /tmp/shots themes/cupertino/theme.css themes/cupertino/login.css files-list,settings
```

Restart the server for the real test – it only reads the CSS files at startup. For work
on the app's code itself there is also `make dev` (Vite HMR + Air).
