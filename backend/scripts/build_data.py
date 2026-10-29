"""CLI do build integral, validação, reprodução e pacote de runtime."""

import argparse
import sys

from backend.artifacts.build import build_dataset
from backend.artifacts.package import package_runtime
from backend.artifacts.reproducibility import verify_reproducibility
from backend.repositories.artifacts import ArtifactRepository


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "action",
        choices=["build", "validate", "reproduce", "package-runtime"],
        nargs="?",
        default="build",
    )
    args = parser.parse_args()
    try:
        if args.action == "build":
            result = build_dataset()
            print(f"Release validado e publicado localmente: {result['release_id']}")
            print(f"Caminho: {result['path']}; reutilizado: {result['reused']}")
        elif args.action == "validate":
            repository = ArtifactRepository(profile="build")
            print(f"Conjunto publicado íntegro: {repository.manifest['release_id']}")
        elif args.action == "reproduce":
            result = verify_reproducibility()
            print(
                f"Dois builds independentes idênticos: {result['release_id']}; "
                f"{result['artifact_count']} artefatos."
            )
        else:
            result = package_runtime()
            print(f"Pacote de runtime validado: {result['path']}")
        return 0
    except (ValueError, OSError) as error:
        print(
            f"Operação interrompida; nenhum ponteiro inválido foi promovido: {error}",
            file=sys.stderr,
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
