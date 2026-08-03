"""Download files from the FTP(S) server into the project folder.

Usage:
    python tools/ftp_fetch.py .htaccess            # -> ./.htaccess
    python tools/ftp_fetch.py .htaccess out.txt    # -> ./out.txt
"""
import json
import os
import sys
from ftplib import FTP_TLS

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CREDENTIALS_PATH = os.path.join(PROJECT_ROOT, ".ftp-credentials.json")


def connect(creds):
    ftp = FTP_TLS()
    ftp.connect(creds["host"], creds.get("port", 21))
    ftp.login(creds["user"], creds["password"])
    if creds.get("use_tls", True):
        ftp.prot_p()
    ftp.cwd(creds.get("remote_dir", "/"))
    return ftp


def main():
    if not sys.argv[1:]:
        print(__doc__)
        return
    remote = sys.argv[1]
    local = sys.argv[2] if len(sys.argv) > 2 else remote

    with open(CREDENTIALS_PATH, "r", encoding="utf-8") as f:
        creds = json.load(f)

    ftp = connect(creds)
    try:
        local_path = os.path.join(PROJECT_ROOT, local)
        os.makedirs(os.path.dirname(local_path) or ".", exist_ok=True)
        with open(local_path, "wb") as out:
            ftp.retrbinary(f"RETR {remote}", out.write)
        print(f"downloaded: {remote} -> {local}")
    finally:
        ftp.quit()


if __name__ == "__main__":
    main()
