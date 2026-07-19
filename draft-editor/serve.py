#!/usr/bin/env python3
"""
Draft Editor server for irenerouragarcia.com (local only).

Serves the website with an editing overlay injected into every page.
Edits, deletions and comments are saved as JSON into draft-editor/drafts/.

Run:    python3 draft-editor/serve.py
Open:   http://localhost:8765
"""
import glob
import json
import os
import re
import sys
import time
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

TOOL_DIR = os.path.dirname(os.path.abspath(__file__))
SITE_DIR = os.path.dirname(TOOL_DIR)
SITE_NAME = os.path.basename(SITE_DIR)
DRAFTS_DIR = os.path.join(TOOL_DIR, "drafts")
HISTORY_DIR = os.path.join(DRAFTS_DIR, "history")
EXPORT_DIR = os.path.join(os.path.expanduser("~"), "Claude accessible", "website update requests")
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765


def site_pages():
    """All top-level HTML pages of the site, index first."""
    pages = sorted(os.path.basename(p) for p in glob.glob(os.path.join(SITE_DIR, "*.html")))
    if "index.html" in pages:
        pages.remove("index.html")
        pages.insert(0, "index.html")
    return pages

os.makedirs(HISTORY_DIR, exist_ok=True)


def safe_page_name(page):
    """Turn a page path like '/about.html' into a safe filename stem."""
    name = page.strip("/").replace(".html", "") or "index"
    name = re.sub(r"[^a-zA-Z0-9_-]", "_", name)
    return name or "index"


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=SITE_DIR, **kwargs)

    def log_message(self, fmt, *args):
        # Quieter log: only show saves and errors
        if "__save__" in (args[0] if args else "") or "POST" in (args[0] if args else ""):
            super().log_message(fmt, *args)

    # ---------- GET ----------
    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/__editor__/editor.js":
            return self.serve_file(os.path.join(TOOL_DIR, "editor.js"), "application/javascript")

        if path == "/__draft__":
            page = parse_qs(parsed.query).get("page", ["index"])[0]
            draft_path = os.path.join(DRAFTS_DIR, safe_page_name(page) + ".json")
            if os.path.exists(draft_path):
                return self.serve_file(draft_path, "application/json")
            return self.send_json({"exists": False})

        # HTML pages get the editor script injected
        file_path = path
        if file_path == "/":
            file_path = "/index.html"
        if file_path.endswith(".html"):
            full = os.path.join(SITE_DIR, file_path.lstrip("/"))
            if os.path.isfile(full):
                with open(full, "r", encoding="utf-8") as f:
                    html = f.read()
                snippet = ('<script>window.__DE_PAGES__ = ' + json.dumps(site_pages()) + ';</script>'
                           '<script src="/__editor__/editor.js" defer></script>')
                if "</body>" in html:
                    html = html.replace("</body>", snippet + "\n</body>", 1)
                else:
                    html += snippet
                body = html.encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                self.wfile.write(body)
                return

        return super().do_GET()

    # ---------- POST ----------
    def do_POST(self):
        parsed = urlparse(self.path)
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length) if length else b"{}"
        try:
            data = json.loads(raw.decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return self.send_json({"ok": False, "error": "bad json"}, status=400)

        if parsed.path == "/__save__":
            page = safe_page_name(data.get("page", "index"))
            draft_path = os.path.join(DRAFTS_DIR, page + ".json")
            with open(draft_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            # Timestamped backup so nothing is ever lost
            stamp = time.strftime("%Y%m%d-%H%M%S")
            with open(os.path.join(HISTORY_DIR, f"{page}-{stamp}.json"), "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print(f"  Saved draft: drafts/{page}.json "
                  f"({len(data.get('edits', []))} edits, {len(data.get('deletions', []))} deletions, "
                  f"{len(data.get('comments', []))} comments)")
            return self.send_json({"ok": True, "file": f"drafts/{page}.json"})

        if parsed.path == "/__export__":
            # Bundle every page draft of this site into one "update request" file
            os.makedirs(EXPORT_DIR, exist_ok=True)
            bundle = {
                "site": SITE_NAME,
                "exportedAt": time.strftime("%Y-%m-%d %H:%M:%S"),
                "pages": {},
            }
            totals = {"edits": 0, "deletions": 0, "comments": 0}
            for path in sorted(glob.glob(os.path.join(DRAFTS_DIR, "*.json"))):
                with open(path, "r", encoding="utf-8") as f:
                    draft = json.load(f)
                page = os.path.splitext(os.path.basename(path))[0]
                bundle["pages"][page] = draft
                for key in totals:
                    totals[key] += len(draft.get(key, []))
                if draft.get("generalComments"):
                    totals["comments"] += 1
            bundle["totals"] = totals
            stamp = time.strftime("%Y-%m-%d %H.%M")
            filename = f"{SITE_NAME} update request {stamp}.json"
            out_path = os.path.join(EXPORT_DIR, filename)
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(bundle, f, ensure_ascii=False, indent=2)
            print(f"  Exported update request: {out_path}")
            return self.send_json({"ok": True, "filename": filename,
                                   "folder": EXPORT_DIR, "bundle": bundle})

        if parsed.path == "/__discard__":
            page = safe_page_name(data.get("page", "index"))
            draft_path = os.path.join(DRAFTS_DIR, page + ".json")
            if os.path.exists(draft_path):
                os.remove(draft_path)
            return self.send_json({"ok": True})

        return self.send_json({"ok": False, "error": "unknown endpoint"}, status=404)

    # ---------- helpers ----------
    def serve_file(self, full_path, content_type):
        try:
            with open(full_path, "rb") as f:
                body = f.read()
        except OSError:
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header("Content-Type", content_type + "; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def send_json(self, obj, status=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    print(f"Draft Editor running.")
    print(f"  Site:   {SITE_DIR}")
    print(f"  Drafts: {DRAFTS_DIR}")
    print(f"  Open:   http://localhost:{PORT}")
    HTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
