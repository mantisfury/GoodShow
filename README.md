# goodshow

A static web app for tracking shows and movies. It can be hosted directly with GitHub Pages because it only uses HTML, CSS, JavaScript, and browser `localStorage`.

## Data sources

- Shows: TVMaze search and episode APIs. No API key required.
- Movies: Wikidata entity search. No API key required, but movie metadata is intentionally lightweight.

## Run locally

```powershell
python -m http.server 5173 --bind 127.0.0.1
```

Then open:

```text
http://127.0.0.1:5173/
```

## Host on GitHub Pages

1. Create a GitHub repository.
2. Push `index.html`, `styles.css`, `app.js`, `.nojekyll`, and this `README.md`.
3. In GitHub, open `Settings -> Pages`.
4. Set the source to `Deploy from a branch`.
5. Choose your default branch and the repository root.
6. Save. GitHub will publish the app at the Pages URL shown in that settings screen.

## Storage note

Library data is stored in each browser's `localStorage`. Hosting on GitHub Pages makes the app accessible from other devices, but it does not sync library data between devices yet.
