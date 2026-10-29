"""Remote, static-preview-only installer. Never deploys PHP or participant data."""
import hashlib
import io
import json
import os
from pathlib import Path
import re
import shutil
import sys
import tarfile
import tempfile

PROJECT = "komahdop-ctrl/pchelovod63-website:opylitel-preview"
PAGES = {"index.html", "agrarian.html", "privacy.html", "consent.html"}
FILES = PAGES | {"release.json", ".htaccess"}
LIMIT = 256 * 1024


def manifest(directory):
    return json.loads((directory / "release.json").read_text())


def install(webroot, release, payload):
    if not re.fullmatch(r"[a-f0-9]{40}", release):
        raise ValueError("Invalid release")
    root = Path(webroot)
    if not root.is_absolute() or not root.is_dir():
        raise ValueError("An existing absolute document root is required")
    root = root.resolve()
    if root == Path("/"):
        raise ValueError("Unsafe document root")
    target = root / "opylitel-preview"
    if target.is_symlink() or (target.exists() and not target.is_dir()):
        raise ValueError("Unsafe preview target")
    if target.exists() and manifest(target).get("project") != PROJECT:
        raise ValueError("Refusing to overwrite an unmanaged directory")
    if len(payload) > LIMIT:
        raise ValueError("Oversized payload")
    backup = root.parent / ".opylitel-preview-backups"
    if backup.is_symlink():
        raise ValueError("Unsafe backup directory")
    backup.mkdir(mode=0o700, exist_ok=True)
    os.chmod(str(backup), 0o700)
    stage = Path(tempfile.mkdtemp(prefix="stage-", dir=str(backup)))
    previous = None
    try:
        with tarfile.open(fileobj=io.BytesIO(payload), mode="r:") as archive:
            members = archive.getmembers()
            if len(members) != len(FILES) or {m.name for m in members} != FILES:
                raise ValueError("Unexpected payload entries")
            if any(not m.isfile() or m.size > LIMIT for m in members):
                raise ValueError("Only regular preview files are allowed")
            if sum(m.size for m in members) > LIMIT:
                raise ValueError("Oversized expanded payload")
            for member in members:
                content = archive.extractfile(member).read()
                (stage / member.name).write_bytes(content)
                os.chmod(str(stage / member.name), 0o644)
        data = manifest(stage)
        if data.get("project") != PROJECT or data.get("commit") != release:
            raise ValueError("Unexpected project or release")
        if set(data.get("sha256", {})) != FILES - {"release.json"}:
            raise ValueError("Incomplete manifest")
        for name, digest in data["sha256"].items():
            if hashlib.sha256((stage / name).read_bytes()).hexdigest() != digest:
                raise ValueError("Payload checksum mismatch")
        for name in PAGES:
            text = (stage / name).read_text()
            if 'content="noindex,nofollow"' not in text or "connect-src 'none'" not in text:
                raise ValueError("Preview restrictions missing")
        if target.exists():
            previous = Path(tempfile.mkdtemp(prefix="previous-", dir=str(backup)))
            previous.rmdir()
            target.rename(previous)
        try:
            os.chmod(str(stage), 0o755)
            stage.rename(target)
            state = backup / "last-deployment.json.new"
            state.write_text(json.dumps({
                "release": release, "previous": previous.name if previous else None
            }))
            state.replace(backup / "last-deployment.json")
        except BaseException:
            if target.exists() and not stage.exists():
                target.rename(stage)
            if previous is not None:
                previous.rename(target)
            raise
        return {"ok": True, "commit": release, "previous_available": previous is not None}
    finally:
        if stage.exists():
            shutil.rmtree(stage)


def rollback(webroot, release):
    root = Path(webroot).resolve(strict=True)
    target = root / "opylitel-preview"
    backup = root.parent / ".opylitel-preview-backups"
    if backup.is_symlink() or target.is_symlink():
        raise ValueError("Unsafe rollback path")
    state = json.loads((backup / "last-deployment.json").read_text())
    if state["release"] != release or manifest(target).get("commit") != release:
        raise ValueError("Preview changed; refusing rollback")
    previous = state["previous"]
    if previous and (not re.fullmatch(r"previous-[a-zA-Z0-9_]+", previous)
                     or not (backup / previous).is_dir()
                     or (backup / previous).is_symlink()):
        raise ValueError("Unsafe previous release")
    failed = Path(tempfile.mkdtemp(prefix="failed-", dir=str(backup)))
    failed.rmdir()
    target.rename(failed)
    if previous:
        (backup / previous).rename(target)
    return {"ok": True, "rolled_back": True}


if __name__ == "__main__":
    try:
        mode, webroot, release = sys.argv[1:]
        if mode == "deploy":
            result = install(webroot, release, sys.stdin.buffer.read(LIMIT + 1))
        elif mode == "rollback":
            result = rollback(webroot, release)
        else:
            raise ValueError("Unsupported mode")
        print(json.dumps(result))
    except Exception as exc:
        # Do not print account paths, credentials or remote exception details.
        print(json.dumps({"ok": False, "error": type(exc).__name__}))
        sys.exit(1)
