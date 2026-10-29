"""Prepare/ship only the static Opylytel preview; all live intake stays closed."""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import re
import shlex
import subprocess
import tarfile
import tempfile
from urllib.parse import urlsplit
from urllib.request import urlopen, Request
import time

from beget_preview_remote import PROJECT, PAGES, FILES

CSP = ("default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; "
       "img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'")


def build(source, output, commit):
    if not re.fullmatch(r"[a-f0-9]{40}", commit):
        raise ValueError("Expected a complete commit SHA")
    output.mkdir(parents=True, exist_ok=True)
    if any(output.iterdir()):
        raise ValueError("Output must be empty")
    for name in sorted(PAGES):
        text = (source / "opylitel" / name).read_text()
        text = re.sub(r'<meta\s+name=["\x27]robots["\x27][^>]*>', '', text, flags=re.I)
        text = text.replace('</head>', '<meta name="robots" content="noindex,nofollow">'
                            '<meta http-equiv="Content-Security-Policy" content="' + CSP + '"></head>')
        if name == "index.html":
            if not all(s in text for s in ["enabled:false", "legalDocumentsApproved:false", "endpoint:''"]):
                raise ValueError("Source no longer has closed intake defaults")
            # Force closed settings for this preview, even if another script sets window config.
            text = text.replace("window.OPYLITEL_INTAKE=window.OPYLITEL_INTAKE||",
                                "window.OPYLITEL_INTAKE=")
            if not re.search(r'<button\b[^>]*\bid="send"[^>]*\bdisabled', text):
                raise ValueError("Disabled submit button missing")
        if re.search(r'<script\b[^>]*\bsrc\s*=', text, re.I):
            raise ValueError("Unexpected external script")
        (output / name).write_text(text)
    (output / ".htaccess").write_text(
        'Options -Indexes\n<IfModule mod_headers.c>\n'
        'Header always set X-Robots-Tag "noindex, nofollow"\n'
        'Header always set X-Content-Type-Options "nosniff"\n'
        'Header always set Referrer-Policy "no-referrer"\n'
        'Header always set Content-Security-Policy "' + CSP + '; frame-ancestors \'none\'"\n'
        '</IfModule>\n')
    data = {"project": PROJECT, "commit": commit, "intake": "closed", "sha256": {}}
    for name in sorted(FILES - {"release.json"}):
        data["sha256"][name] = hashlib.sha256((output / name).read_bytes()).hexdigest()
    (output / "release.json").write_text(json.dumps(data, sort_keys=True) + '\n')
    return data


def package(directory):
    if {p.name for p in directory.iterdir()} != FILES:
        raise ValueError("Unexpected preview files")
    result = io.BytesIO()
    with tarfile.open(fileobj=result, mode="w:") as archive:
        for name in sorted(FILES):
            path = directory / name
            if path.is_symlink() or not path.is_file():
                raise ValueError("Only regular files may be shipped")
            archive.add(str(path), arcname=name, recursive=False)
    return result.getvalue()


def verify_url(base, expected):
    parts = urlsplit(base)
    if parts.scheme != "https" or not parts.hostname or parts.username or parts.password or parts.query or parts.fragment:
        raise ValueError("Expected an HTTPS preview URL without credentials/query")
    if not parts.path.rstrip('/').endswith('/opylitel-preview'):
        raise ValueError("Preview URL must end with /opylitel-preview/")
    # Compare actual public page bytes, not an HTTP 200 (which can be a proxy error page).
    for name in ["release.json"] + sorted(PAGES):
        req = Request(base.rstrip('/') + '/' + name + '?release=' + expected["commit"],
                      headers={"Cache-Control": "no-cache", "User-Agent": "Opylytel-preview-check"})
        with urlopen(req, timeout=20) as response:
            actual = urlsplit(response.geturl())
            if actual.scheme != "https" or actual.netloc != parts.netloc:
                raise ValueError("Unexpected redirect")
            body = response.read(256 * 1024 + 1)
        if len(body) > 256 * 1024:
            raise ValueError("Oversized HTTP response")
        if name == "release.json":
            if json.loads(body) != expected:
                raise ValueError("Public release differs")
        elif hashlib.sha256(body).hexdigest() != expected["sha256"][name]:
            raise ValueError("Public page checksum differs")


def deploy(directory):
    required = ["BEGET_HOST", "BEGET_USER", "BEGET_WEB_ROOT", "BEGET_PREVIEW_URL",
                "BEGET_SSH_KEY", "BEGET_KNOWN_HOSTS"]
    missing = [key for key in required if not os.environ.get(key)]
    if missing:
        raise ValueError("One-time setup incomplete; missing: " + ', '.join(missing))
    host, user = os.environ["BEGET_HOST"], os.environ["BEGET_USER"]
    if not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9.-]*", host) or not re.fullmatch(r"[a-zA-Z0-9_][a-zA-Z0-9_-]*", user):
        raise ValueError("Invalid SSH host/user")
    root = os.environ["BEGET_WEB_ROOT"]
    if not root.startswith('/') or any(c in root for c in ['\n', '\r', '\x00']):
        raise ValueError("Invalid document root")
    expected = json.loads((directory / "release.json").read_text())
    remote = Path(__file__).with_name("beget_preview_remote.py").read_text()
    with tempfile.TemporaryDirectory(prefix="beget-ssh-") as tmp:
        key, known = Path(tmp) / 'key', Path(tmp) / 'known_hosts'
        key.write_text(os.environ["BEGET_SSH_KEY"].rstrip() + '\n')
        known.write_text(os.environ["BEGET_KNOWN_HOSTS"].rstrip() + '\n')
        key.chmod(0o600)
        known.chmod(0o600)
        ssh = ["ssh", "-F", "/dev/null", "-i", str(key), "-o", "BatchMode=yes",
               "-o", "IdentitiesOnly=yes", "-o", "StrictHostKeyChecking=yes",
               "-o", "UserKnownHostsFile=" + str(known), "-o", "ConnectTimeout=15",
               user + '@' + host]

        def call(mode, data=None):
            command = shlex.join(["python3", "-c", remote, mode, root, expected["commit"]])
            proc = subprocess.run(ssh + [command], input=data, capture_output=True, timeout=120)
            if proc.returncode:
                raise RuntimeError("SSH operation failed; account details suppressed")
            answer = json.loads(proc.stdout)
            if not answer.get('ok'):
                raise RuntimeError("Remote operation was not confirmed")
            return answer

        call('deploy', package(directory))
        for attempt in range(3):
            try:
                verify_url(os.environ["BEGET_PREVIEW_URL"], expected)
                print("Preview deployed and all four HTTPS page checksums verified. Intake remains closed.")
                return
            except Exception:
                if attempt < 2:
                    time.sleep(3)
        call('rollback')
        raise RuntimeError("HTTPS content verification failed; preview rolled back")


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', choices=['build', 'deploy'])
    parser.add_argument('--source', type=Path, default=Path('.'))
    parser.add_argument('--output', type=Path, default=Path('dist/beget-preview'))
    parser.add_argument('--commit', default=os.environ.get('GITHUB_SHA', ''))
    args = parser.parse_args()
    try:
        if args.mode == 'build':
            build(args.source, args.output, args.commit)
            print('Static preview prepared; intake closed; no PHP or personal data included.')
        else:
            deploy(args.output)
    except Exception as exc:
        # Only known setup errors can be shown; other errors might contain account paths.
        if isinstance(exc, ValueError) and str(exc).startswith('One-time setup incomplete'):
            print(str(exc), file=__import__('sys').stderr)
        else:
            print('Preview operation failed (' + type(exc).__name__ + '); deployment not confirmed.',
                  file=__import__('sys').stderr)
        raise SystemExit(1)
