"""Inicia API e Vite com encerramento conjunto dos processos ao sair."""

import signal
import subprocess
import sys
import time

from backend.app.config import settings


def main():
    processes = []
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
    try:
        commands = [
            [
                sys.executable,
                "-m",
                "uvicorn",
                "backend.app.main:app",
                "--host",
                "127.0.0.1",
                "--port",
                "8000",
            ],
            ["npm", "run", "dev", "--prefix", "frontend"],
        ]
        for command in commands:
            processes.append(
                subprocess.Popen(command, cwd=settings.project_root, start_new_session=True)
            )
        print("QuadraScope: http://127.0.0.1:5173 · API: http://127.0.0.1:8000/docs", flush=True)
        while all(process.poll() is None for process in processes):
            time.sleep(0.25)
        return next((p.returncode for p in processes if p.returncode), 0)
    except KeyboardInterrupt:
        return 0
    finally:
        import os

        for process in processes:
            if process.poll() is None:
                os.killpg(process.pid, signal.SIGTERM)
        for process in processes:
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait()


if __name__ == "__main__":
    raise SystemExit(main())
