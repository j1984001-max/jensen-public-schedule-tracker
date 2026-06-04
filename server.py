#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parent


class StandaloneHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()


def main() -> None:
    parser = argparse.ArgumentParser(description="啟動黃仁勳公開行程追蹤獨立網站")
    parser.add_argument("--host", default=os.environ.get("HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", "8787")))
    args = parser.parse_args()

    server = ThreadingHTTPServer((args.host, args.port), StandaloneHandler)
    print(f"Serving standalone tracker at http://{args.host}:{args.port}/")
    server.serve_forever()


if __name__ == "__main__":
    main()
