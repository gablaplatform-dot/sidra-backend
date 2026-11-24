"""Collect factual service listing references and their original item photos from public
Jiji Uganda Services pages. Mirrors collect.py's safety properties (cached pages, verified
images, explicit provenance) for the simpler, flat Gabla service-category tree: every
Gabla service category is a root with no required listing fields, so there is no field
extraction step here - only the facts a listing itself needs: name, price, photo, source.
"""
import argparse
import concurrent.futures
import hashlib
import io
import json
import re
import time
from collections import Counter, defaultdict, deque
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urlparse
from PIL import Image

ROOT = Path(__file__).resolve().parent
CACHE = Path("/tmp/gabla-services-sources")
CACHE.mkdir(exist_ok=True)
HEADERS = {"User-Agent": "Mozilla/5.0"}
OFFLINE = False


def fetch_page(source):
    slug, category_name, page = source
    url = "https://jiji.ug/" + slug + ("?page=" + str(page) if page > 1 else "")
    cache = CACHE / (slug + "-" + str(page) + ".html")
    try:
        if cache.exists():
            html = cache.read_text()
        else:
            if OFFLINE:
                return [], None
            with urlopen(Request(url, headers=HEADERS), timeout=25) as response:
                html = response.read().decode()
            cache.write_text(html)
        scripts = re.findall(r"<script[^>]*>(.*?)</script>", html, re.S)
        state = json.loads(next(s for s in scripts if s.startswith('[["ShallowReactive"')))

        def resolve(index, depth=0):
            if index < 0 or depth > 14:
                return None
            item = state[index]
            if isinstance(item, dict):
                return {key: resolve(value, depth + 1) for key, value in item.items()}
            if isinstance(item, list):
                return [resolve(value, depth + 1) if isinstance(value, int) else value for value in item]
            return item

        listing = next(item for item in state if isinstance(item, dict) and "adverts_list" in item)
        adverts = resolve(listing["adverts_list"]).get("adverts", [])
        rows = []
        for item in adverts:
            image = (item.get("image_obj") or {}).get("url")
            price = (item.get("price_obj") or {}).get("value")
            if not image or not isinstance(price, (int, float)) or price <= 0:
                continue
            rows.append({
                "sourceId": str(item["id"]),
                "sourceUrl": "https://jiji.ug" + item["url"],
                "sourceCategory": item["category_name"],
                "sourceSlug": slug,
                "gablaCategoryName": category_name,
                "name": item["title"],
                "price": price,
                "currency": "UGX",
                "pricePeriod": (item.get("price_obj") or {}).get("period"),
                "imageUrl": image,
                "district": item.get("region_parent_name"),
                "sourceRegion": item.get("region_name"),
            })
        return rows, None
    except Exception as error:
        return [], {"url": url, "error": str(error)[:160]}


def validate_image(item):
    url = item["imageUrl"]
    if urlparse(url).scheme != "https" or not urlparse(url).hostname.endswith(".jijistatic.com"):
        return None
    cache = CACHE / (hashlib.sha256(url.encode()).hexdigest() + ".img")
    try:
        if cache.exists():
            content = cache.read_bytes()
        else:
            with urlopen(Request(url, headers=HEADERS), timeout=20) as response:
                content = response.read(2 * 1024 * 1024)
            cache.write_bytes(content)
        with Image.open(io.BytesIO(content)) as image:
            width, height = image.size
            image.verify()
        if min(width, height) < 150:
            return None
        return {**item, "imageWidth": width, "imageHeight": height}
    except Exception:
        return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    parser.add_argument("--count", type=int, default=120)
    parser.add_argument("--offline", action="store_true")
    args = parser.parse_args()
    global OFFLINE
    OFFLINE = args.offline

    sources = json.loads((ROOT / "sources-services.json").read_text())
    collected = {}
    errors = []
    for page in [1, 2, 3]:
        requests = [(slug, category_name, page) for slug, category_name in sources]
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
            for rows, error in pool.map(fetch_page, requests):
                if error:
                    errors.append(error)
                for item in rows:
                    collected.setdefault(item["sourceUrl"], item)
        print(json.dumps({"page": page, "sourceItems": len(collected), "sourceErrors": len(errors)}), flush=True)
        if len(collected) >= args.count * 3 or page == 3:
            break

    # Round-robin by Gabla category so one busy Jiji category (e.g. Repair Services) cannot
    # crowd out the thinner ones (e.g. Recruitment Services) before the count target is hit.
    grouped = defaultdict(deque)
    for item in collected.values():
        grouped[item["gablaCategoryName"]].append(item)
    ordered = []
    while grouped:
        for name in list(grouped):
            queue = grouped[name]
            ordered.append(queue.popleft())
            if not queue:
                del grouped[name]

    verified = []
    images = set()
    for start in range(0, len(ordered), 60):
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
            for item in pool.map(validate_image, ordered[start:start + 60]):
                if item and item["imageUrl"] not in images:
                    images.add(item["imageUrl"])
                    verified.append(item)
        print(json.dumps({"photosVerified": len(verified), "candidatesChecked": min(start + 60, len(ordered))}), flush=True)
        if len(verified) >= args.count:
            break
    verified = verified[:args.count]

    payload = {
        "batch": "services-20261124",
        "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source": "Public Jiji Uganda service listings",
        "items": verified,
        "summary": {
            "items": len(verified),
            "categories": len({item["gablaCategoryName"] for item in verified}),
            "photos": len({item["imageUrl"] for item in verified}),
            "categoryCounts": dict(Counter(item["gablaCategoryName"] for item in verified)),
        },
        "sourceErrors": errors,
    }
    Path(args.output).write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(payload["summary"]), flush=True)
    if len(verified) < args.count:
        raise SystemExit("Insufficient validated items; manifest saved for review before seeding.")


if __name__ == "__main__":
    main()
