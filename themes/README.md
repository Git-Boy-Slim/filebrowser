# Eigene Themes für FileBrowser Quantum

Ein Theme ist eine reine CSS-Datei – am App-Code muss nichts geändert werden.

```
themes/
├── cupertino/                macOS-/iOS-Theme nach den Human Interface Guidelines
│   ├── theme.css             Nutzer-Theme (customThemes) – hell + dunkel, live umschaltbar
│   ├── login.css             Login-Seite (customCSS) – wirkt nur innerhalb von #login
│   └── config.example.yaml   Beispiel für frontend.styling in der config.yaml
└── dev/
    ├── config.dev.yaml       Config für eine lokale Testinstanz (Port 8090)
    └── shot.js               Playwright: Screenshots aller Ansichten (hell/dunkel, mobil)
```

## Cupertino auf einen Blick

- **Akzentfarbe:** Die sechs Farben der Auswahl im Profil sind auf Apple-Systemfarben
  umdefiniert. Ordner, Schalter, Auswahl und Buttons folgen der gewählten Farbe; eine
  eigene Hex-Farbe funktioniert ebenfalls (die Ordnerfarben werden dann daraus gemischt).
- **Symbole:** Ordner und Dateitypen sind eigene Vektorzeichnungen im macOS-Stil, rein in
  CSS (Masken + `data-type`/`data-name` der Listeneinträge). Dateien mit Vorschaubild
  behalten ihr Bild. In schmalen Listen wird die Endung ausgeblendet und die Glyphe größer.
- **Ansichten:** Liste/Kompakt als gruppierte Tabellen (Ordner / Dateien), Kacheln und
  Symbole wie im Finder (Rand erst bei Auswahl), mobil als gruppierte Liste wie in der
  iOS-Dateien-App.
- **Einstellungen:** eine durchgehende Liste aus gruppierten Tabellen mit
  Abschnittsüberschriften, iOS-Schaltern und einem Segmented Control mit Farbpunkten;
  die Navigation links wie die Startseite der iOS-Einstellungen.
- **Login:** Über `customCSS`, weil die App auf der Login-Seite noch keinen Nutzer und
  damit kein Nutzer-Theme kennt. Die Datei ist auf `#login` begrenzt, beeinflusst also
  weder die App noch andere Themes.

## So funktioniert das Theming

**Laden** (`backend/pkg/settings/config.go`, `styling.go`)
- Beim Start liest das Backend jede Datei aus `frontend.styling.customThemes[*].css`
  und `customCSS` per `os.ReadFile`. Relative Pfade gelten ab dem **Arbeitsverzeichnis
  des Prozesses** (Docker: `/home/filebrowser`), nicht ab der config.yaml.
- Datei leer, nicht lesbar oder > 128 KB → Warnung im Log, Theme fehlt in der Auswahl.
- Änderungen an der CSS-Datei greifen erst nach einem Neustart.
- Ein Eintrag `default` ist immer vorhanden (wird sonst automatisch ergänzt).

**Einbinden** (`backend/internal/web/static.go`, `frontend/public/index.html`)
- Reihenfolge in der Seite:
  1. `<head>`: `css/variables.css` (Farbvariablen), Inline-Style mit `--background`
     aus `lightBackground`/`darkBackground`, App-CSS
  2. Ende von `<body>`: `customCSS` (für alle), dann `<style id="user-selected-theme">`
     mit dem Theme, das der Nutzer gewählt hat (bzw. das der Freigabe)
- Das Theme steht also zuletzt und gewinnt bei gleicher Spezifität.
- Nur für eingeloggte Nutzer und Freigaben mit eigenem Theme; die Login-Seite
  sieht nur `customCSS`. Für ein einheitliches Login-Design also `customCSS` nutzen.
- Während eines Event-Themes (Halloween) wird das Nutzer-Theme deaktiviert.

**Dunkelmodus**: `frontend/src/utils/theme.js` schaltet die Klasse `.dark-mode` auf `<html>`.

**Akzentfarbe**: `Layout.vue` setzt beim Laden `--primaryColor` als Inline-Style auf
`<html>` (Standard: `var(--blue)`). Inline schlägt das Theme – deshalb entweder
`--blue` umfärben oder `--primaryColor: … !important` setzen.

## Wichtigste Variablen (nach Nutzungshäufigkeit im Frontend)

| Variable | Zweck | Verwendungen |
|---|---|---|
| `--primaryColor` | Akzent (Buttons, Links, Auswahl) | 146 |
| `--textSecondary` / `--textPrimary` | Text | 96 / 83 |
| `--divider` | Linien, Rahmen | 75 |
| `--borderRadius` / `--borderWidth` | Rundung, Rahmenstärke | 70 / 38 |
| `--surfaceSecondary` / `--surfacePrimary` | Karten, Einträge, Hover | 50 / 26 |
| `--background` / `--alt-background` | Seite / Header & Panels | 36 / 15 |
| `--hoverOverlay`, `--overlay`, `--panel-bg`, `--panel-blur` | Zustände, Glas-Effekt | |
| `--icon-*` | Farben der Dateityp-Icons | |

Quellen: `frontend/public/css/variables.css` (Farben hell/dunkel),
`frontend/src/css/_variables.css` (Form, Schatten, Icons).

Schrift: Standard ist Roboto (lokal). Die CSP der App schränkt `style-src`/`font-src`
nicht ein, externe Webfonts per `@import` sind also technisch möglich.

## Lokal starten und Screenshots machen

Voraussetzungen: Node 22, Go (das Modul verlangt Go 1.27; mit `GOTOOLCHAIN=auto`
lädt Go die passende Version selbst).

```bash
# 1. Frontend bauen (landet in backend/internal/web/embed)
cd frontend && npm ci && npm run build && cd ..

# 2. Backend bauen
cd backend && GOTOOLCHAIN=auto go build -o ../themes/dev/filebrowser . && cd ..

# 3. Testinstanz starten (aus themes/dev, wegen relativer Pfade)
cd themes/dev && mkdir -p files && ./filebrowser -c config.dev.yaml
# → http://localhost:8090, Login admin / admin1234

# 4. Screenshots (zweites Terminal)
node themes/dev/shot.js themes/dev/shots
```

Schneller iterieren ohne Neustart: `shot.js` kann die CSS-Dateien direkt in die Seite
injizieren und optional nur bestimmte Ansichten fotografieren:

```bash
node themes/dev/shot.js /tmp/shots themes/cupertino/theme.css themes/cupertino/login.css files-list,settings
```

Erst für den echten Test (oder nach dem Commit) den Server neu starten – er liest die
CSS-Dateien nur beim Start.
Für Arbeit an App-Code gibt es zusätzlich `make dev` (Vite-HMR + Air).
