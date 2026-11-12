"""Compare the allowlisted Render Auth build to the public staging artifact."""
import hashlib
import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ORIGIN = "https://tien404-auth-staging.onrender.com"
MAX_BYTES = 2 * 1024 * 1024


def check(entry):
    relative, expected = entry
    started = time.monotonic()
    request = Request(f"{ORIGIN}/{relative}", headers={"Cache-Control": "no-cache"})
    try:
        with urlopen(request, timeout=25) as response:
            body = response.read(MAX_BYTES + 1)
            matched = (response.geturl() == request.full_url and len(body) <= MAX_BYTES
                       and hashlib.sha256(body).digest() == expected)
            result = "PASS" if matched else "MISMATCH"
    except (HTTPError, URLError, TimeoutError, OSError) as error:
        result = f"ERROR:{getattr(error, 'code', type(error).__name__)}"
    return {"asset": relative, "result": result, "ms": round((time.monotonic()-started)*1000)}


def main():
    root = Path(sys.argv[1])
    entries = [(p.relative_to(root).as_posix(), hashlib.sha256(p.read_bytes()).digest())
               for p in sorted(root.rglob("*")) if p.is_file()]
    names = {name for name, _ in entries}
    if not {"account.html", "login.html", "assets/auth-login.js", "assets/auth-account.js"} <= names:
        sys.exit("Missing required Auth build artifacts")
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(check, entries))
    print(json.dumps(results, ensure_ascii=False, indent=2))
    return int(any(row["result"] != "PASS" for row in results))


if __name__ == "__main__":
    sys.exit(main())
