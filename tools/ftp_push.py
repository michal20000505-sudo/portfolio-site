"""Push the contents of this project folder to the FTP(S) server.

Usage:
    python tools/ftp_push.py            # upload everything (skips ignored paths)
    python tools/ftp_push.py index.html # upload a single file
"""
import json
import os
import sys
from ftplib import FTP_TLS

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CREDENTIALS_PATH = os.path.join(PROJECT_ROOT, ".ftp-credentials.json")

SKIP_DIRS = {".git", ".claude", "node_modules", "tools", "__pycache__"}
SKIP_FILES = {".ftp-credentials.json", ".gitignore"}


def load_credentials():
    with open(CREDENTIALS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def connect(creds):
    ftp = FTP_TLS()
    ftp.connect(creds["host"], creds.get("port", 21))
    ftp.login(creds["user"], creds["password"])
    if creds.get("use_tls", True):
        ftp.prot_p()
    ftp.cwd(creds.get("remote_dir", "/"))
    return ftp


def ensure_remote_dir(ftp, path):
    parts = path.strip("/").split("/")
    current = ""
    for part in parts:
        if not part:
            continue
        current += "/" + part
        try:
            ftp.mkd(current)
        except Exception:
            pass


def upload_file(ftp, local_path, remote_path):
    remote_dir = os.path.dirname(remote_path).replace("\\", "/")
    if remote_dir:
        ensure_remote_dir(ftp, remote_dir)
        ftp.cwd("/")
    with open(local_path, "rb") as f:
        ftp.storbinary(f"STOR {remote_path}", f)
    print(f"uploaded: {remote_path}")


def iter_local_files(root):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and not d.startswith(".")]
        for name in filenames:
            if name in SKIP_FILES:
                continue
            full_path = os.path.join(dirpath, name)
            rel_path = os.path.relpath(full_path, root).replace("\\", "/")
            yield full_path, rel_path


def main():
    creds = load_credentials()
    ftp = connect(creds)

    targets = sys.argv[1:]
    try:
        if targets:
            for rel in targets:
                local_path = os.path.join(PROJECT_ROOT, rel)
                upload_file(ftp, local_path, rel)
        else:
            for local_path, rel_path in iter_local_files(PROJECT_ROOT):
                upload_file(ftp, local_path, rel_path)
    finally:
        ftp.quit()


if __name__ == "__main__":
    main()
