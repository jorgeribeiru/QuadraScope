"""Empacota o código entregue, sem ambientes/caches, com hashes verificáveis."""

import json
import subprocess
from hashlib import sha256
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

from backend.app.config import settings


def prepare_delivery(project: Path = settings.project_root) -> dict:
    names = (
        subprocess.check_output(
            ["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"], cwd=project
        )
        .decode()
        .split("\0")
    )
    files = {}
    payloads = {}
    for name in sorted(set(filter(None, names))):
        path = project / name
        if path.is_symlink() or not path.is_file():
            raise ValueError(f"Arquivo de entrega ausente ou link simbólico: {name}")
        payloads[name] = path.read_bytes()
        files[name] = sha256(payloads[name]).hexdigest()
    for required in (
        "README.md",
        "Makefile",
        "uv.lock",
        "requirements.txt",
        "requirements-runtime.txt",
        "frontend/package-lock.json",
        "data/raw/stats_times_regular_final.csv",
        "docs/development/delivery.md",
        ".github/workflows/ci.yml",
    ):
        if required not in files:
            raise ValueError(f"Entrega incompleta: {required}")
    source_hash = sha256(json.dumps(files, sort_keys=True).encode()).hexdigest()
    manifest = {
        "base_commit": subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=project, text=True
        ).strip(),
        "git_dirty": bool(subprocess.check_output(["git", "status", "--porcelain"], cwd=project)),
        "revision_kind": "working_tree_snapshot",
        "source_snapshot_sha256": source_hash,
        "files": files,
        "public_url": "https://quadrascope.vercel.app",
        "classroom_submission_confirmed": False,
    }
    output = project / "dist/delivery"
    output.mkdir(parents=True, exist_ok=True)
    archive = output / f"quadrascope-{source_hash[:12]}.zip"
    payloads["DELIVERY-MANIFEST.json"] = (
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
    ).encode()
    with ZipFile(archive, "w", compression=ZIP_DEFLATED) as package:
        for name, content in sorted(payloads.items()):
            entry = ZipInfo(f"QuadraScope/{name}", date_time=(2026, 1, 1, 0, 0, 0))
            entry.compress_type = ZIP_DEFLATED
            entry.external_attr = 0o100644 << 16
            package.writestr(entry, content)
    with ZipFile(archive) as package:
        if package.testzip() is not None:
            raise ValueError("ZIP inválido")
        for name, checksum in files.items():
            if sha256(package.read(f"QuadraScope/{name}")).hexdigest() != checksum:
                raise ValueError(f"Hash divergente: {name}")
    report = {
        **manifest,
        "archive": str(archive.relative_to(project)),
        "archive_sha256": sha256(archive.read_bytes()).hexdigest(),
        "archive_bytes": archive.stat().st_size,
        "status": "passed",
    }
    (output / "manifest.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    return report


if __name__ == "__main__":
    result = prepare_delivery()
    print(
        json.dumps(
            {
                k: result[k]
                for k in (
                    "archive",
                    "archive_sha256",
                    "source_snapshot_sha256",
                    "git_dirty",
                    "status",
                )
            },
            indent=2,
        )
    )
