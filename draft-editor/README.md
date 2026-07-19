# Draft Editor (local tool — never deployed)

Lets Irene edit the website text in the browser, delete blocks, and leave
comments. Everything is saved as JSON drafts that Claude then uses to update
the real HTML/translations.

## How to start it

In Claude Code just say "start the draft editor", or in Terminal:

```
python3 "/Users/irene/Claude accessible/websites/fndcareguide/draft-editor/serve.py" 8766
```

Then open **http://localhost:8766** in your browser.

## How to use it

- **Click any text** to edit it in place (like a document).
- **Hover a block** for 🗑 Delete (strike-through, marked for removal) and 💬 Comment.
- **Purple panel (bottom right)**: switch pages, see change counts, write
  overall comments for Claude, Save / Discard the draft.
- **Edit / Browse toggle**: Browse mode makes links and buttons work normally
  again. In Edit mode, clicking a link edits its text instead of navigating.
- Drafts **auto-save** 2 seconds after you stop typing (and on Cmd+S).
- Tip: pick your language (EN/ES) *before* editing — the draft records which
  language you were editing.

- **📤 Export update request**: bundles every page's edits and comments into
  one file in `~/Claude accessible/website update requests/` (and downloads a
  copy). Give that file to Claude — or just say "I'm done drafting".

## Where drafts go

- `drafts/<page>.json` — the current draft per page (this is what Claude reads)
- `drafts/history/` — timestamped backups of every save

Each JSON records, per block: its `data-i18n` key, the original text, the new
text, deletions, and comments — so Claude can map edits back to `index.html`
etc. and to the translations in `script.js`.

Nothing here touches the live site; changes only go live when Claude applies
the draft to the real files and they are deployed as usual.
