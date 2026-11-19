"""Collect factual catalogue references and their original item photos from public Jiji pages."""
import argparse
import concurrent.futures
import hashlib
import io
import json
import re
import time
from collections import Counter, defaultdict, deque
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from PIL import Image

ROOT = Path(__file__).resolve().parent
CACHE = Path("/tmp/gabla-catalog-sources")
CACHE.mkdir(exist_ok=True)
HEADERS = {"User-Agent": "Mozilla/5.0"}
OFFLINE = False
NORMAL = lambda value: re.sub(r"[^a-z0-9]+", "", str(value).lower())


def fetch_page(source):
    slug, paths, page = source[:3]
    mixed_search = len(source) > 3 and source[3] is True and slug.startswith('search?query=')
    url = "https://jiji.ug/" + slug + (("&" if '?' in slug else "?") + "page=" + str(page) if page > 1 else "")
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
            # A source category URL must contain adverts of that category, not a redirect to the home feed.
            canonical_slug = {'other-repair-and-construction-items': 'other-repair-and-constraction-items'}.get(slug, slug)
            if item.get("category_slug") != canonical_slug and not mixed_search:
                continue
            rows.append({
                "sourceId": str(item["id"]),
                "sourceUrl": "https://jiji.ug" + item["url"],
                "sourceCategory": item["category_name"],
                "sourceSlug": item.get('category_slug') if mixed_search else slug,
                "targets": paths,
                "name": item["title"],
                "price": price,
                "currency": "UGX",
                "pricePeriod": (item.get("price_obj") or {}).get("period"),
                "imageUrl": image,
                "attributes": item.get("attrs", []),
                "district": item.get("region_parent_name"),
                "sourceRegion": item.get("region_name"),
            })
        return rows, None
    except Exception as error:
        return [], {"url": url, "error": str(error)[:160]}


def field_values(item, definitions):
    attrs = {NORMAL(a["name"]): str(a.get("value", "")) for a in item["attributes"] if a.get("name")}
    title = item["name"]
    found = {}
    missing = []
    for field in definitions:
        key = field["key"]
        label = field.get("label", key)
        raw = attrs.get(NORMAL(label), attrs.get(NORMAL(key), ""))
        field_type = field.get("type")
        options = field.get("options", [])
        values = []
        if field_type in ("select", "multi_select"):
            raw_parts = [NORMAL(part) for part in re.split(r"[,;]", raw) if part.strip()]
            if options:
                values = [option for option in options if NORMAL(option) in raw_parts]
                if not values:
                    values = [option for option in options if len(str(option)) > 1 and re.search(
                        r"(?<![a-z0-9])" + re.escape(str(option)) + r"(?![a-z0-9])", title, re.I)]
                aliases = {
                    "Apple": r"\biphone\b|\bipad\b|\bmacbook\b|\bimac\b",
                    "Mercedes-Benz": r"\bmercedes\s+benz\b",
                    "Sofas": r"\bsofa\b|\bcouch\b", "Wardrobes": r"\bwardrobe\b",
                    "Office Chairs": r"\boffice chair\b|\bexecutive chair\b",
                    "Dining Tables": r"\bdining table\b", "Beds & Bed Frames": r"\bbed frame\b|\bdouble bed\b",
                    "Books": r"\bbook\b", "Acoustic Guitars": r"\bacoustic guitar\b",
                    "Bass Guitars": r"\bbass guitar\b", "Ab Rollers": r"\bab roller\b",
                }
                if not values:
                    values = [option for option in options if option in aliases and re.search(aliases[option], title, re.I)]
                if not values and key == "bedrooms":
                    match = re.search(r"(\d+)\s*(?:bdrm|bedroom|bed\b)", title, re.I)
                    if match:
                        value = match[1] if int(match[1]) < 6 else "6+"
                        if value in options:
                            values = [value]
                if not values and key == "room":
                    room_rules = [
                        (r"office|computer|executive|reception", "Home Office"),
                        (r"dining", "Dining Room"),
                        (r"bed|mattress|wardrobe", "Bedroom"),
                        (r"sofa|couch|recliner|tv stand|coffee table", "Living Room"),
                    ]
                    values = [room for pattern, room in room_rules if room in options and re.search(pattern, title, re.I)][:1]
            elif raw:
                values = [raw]
            elif key == "type":
                for term in ["Lotion", "Cream", "Sunscreen", "Body Wash", "Soap", "Serum", "Lipstick", "Foundation", "Concealer", "Mascara", "Wig", "Shampoo"]:
                    if re.search(r"\b" + re.escape(term) + r"\b", title, re.I):
                        values = [term]
                        break
            if values:
                found[key] = values if field_type == "multi_select" else max(values, key=lambda value: len(str(value)))
        elif field_type == "number":
            candidate = raw
            if not candidate and key == "yearOfManufacture":
                match = re.search(r"\b(19[89]\d|20[0-2]\d)\b", title)
                candidate = match[1] if match else ""
            number = re.search(r"\d+(?:\.\d+)?", candidate.replace(",", ""))
            if number:
                found[key] = float(number[0])
        elif field_type == "boolean":
            if raw.lower() in ["yes", "true", "no", "false"]:
                found[key] = raw.lower() in ["yes", "true"]
        elif raw:
            found[key] = raw
        if field.get("required") and key not in found:
            missing.append(key)
    return found, missing


def enrich(item):
    cache = CACHE / ("detail-" + item["sourceId"] + ".json")
    try:
        if cache.exists():
            attrs = json.loads(cache.read_text())
        else:
            with urlopen(Request(item["sourceUrl"], headers=HEADERS), timeout=20) as response:
                html = response.read().decode()
            state = json.loads(next(s for s in re.findall(r"<script[^>]*>(.*?)</script>", html, re.S)
                                    if s.startswith('[["ShallowReactive"')))
            def resolve(index, depth=0):
                if index < 0 or depth > 14:
                    return None
                value = state[index]
                if isinstance(value, dict):
                    return {k: resolve(v, depth + 1) for k, v in value.items()}
                if isinstance(value, list):
                    return [resolve(v, depth + 1) if isinstance(v, int) else v for v in value]
                return value
            advert = next(v for v in state if isinstance(v, dict) and "attrs" in v and "is_active" in v)
            attrs = resolve(advert["attrs"])
            cache.write_text(json.dumps(attrs))
        return {**item, "attributes": attrs}
    except Exception:
        return item


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
    parser.add_argument("--taxonomy", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--count", type=int, default=600)
    parser.add_argument("--offline", action="store_true")
    args = parser.parse_args()
    global OFFLINE
    OFFLINE = args.offline
    taxonomy = json.loads(Path(args.taxonomy).read_text())
    by_id = {row["id"]: row for row in taxonomy["shop"]}
    paths = {}
    definitions = {}
    for row in by_id.values():
        chain = []
        node = row
        while node:
            chain.insert(0, node)
            node = by_id.get(node["parentId"])
        path = " > ".join(node["name"] for node in chain)
        paths[path] = (row["id"], chain[0]["id"])
        fields = {}
        for node in chain:
            fields.update({field["key"]: field for field in node.get("listingFields", [])})
        definitions[path] = list(fields.values())
    sources = json.loads((ROOT / "sources.json").read_text())
    collected = {}
    errors = []
    for page in [1, 2, 3, 4, 5]:
        requests = [(slug, [path for path in target if path in paths], page) for slug, target in sources]
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
            for rows, error in pool.map(fetch_page, requests):
                if error:
                    errors.append(error)
                for item in rows:
                    collected.setdefault(item["sourceUrl"], item)
        if page == 1 and not OFFLINE:
            enrichment = []
            per_source = Counter()
            for item in collected.values():
                if per_source[item["sourceSlug"]] < 6:
                    enrichment.append(item)
                    per_source[item["sourceSlug"]] += 1
            with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
                for item in pool.map(enrich, enrichment):
                    collected[item["sourceUrl"]] = item
            print(json.dumps({"detailPages": len(enrichment)}), flush=True)
        print(json.dumps({"page": page, "sourceItems": len(collected), "sourceErrors": len(errors)}), flush=True)
        candidates = []
        missing_counts = Counter()
        for index, item in enumerate(collected.values()):
            detail_cache = CACHE / ("detail-" + item["sourceId"] + ".json")
            if detail_cache.exists():
                item = {**item, "attributes": json.loads(detail_cache.read_text())}
            targets = item["targets"]
            if not targets:
                continue
            # Gendered categories must always have an explicit source gender. The earlier
            # fallback randomly placed Unisex items into women's categories.
            source_gender = next((str(a.get("value", "")) for a in item["attributes"]
                                  if NORMAL(a.get("name", "")) == "gender"), "").lower()
            if item['sourceSlug'] in ('clothing', 'shoes', 'bags', 'watches', 'jewellery-and-watches'):
                if source_gender == "women's":
                    targets = [p for p in targets if "Women's" in p]
                elif source_gender in ("men's", 'unisex'):
                    targets = [p for p in targets if "Men's" in p or 'Men wear' in p]
                else:
                    continue
                if not targets:
                    continue
            path = targets[index % len(targets)]
            if item["sourceSlug"] == "furniture":
                furniture_paths = [
                    (r"sofa|couch|chair|stool|bench|recliner", "Furniture > Home furniture > Seating furniture"),
                    (r"dining table|coffee table|centre table|center table", "Furniture > Home furniture > Tables furniture"),
                    (r"wardrobe|cabinet|shelf|shelves|cupboard", "Furniture > Home furniture > Storage furniture"),
                    (r"mattress|\bbed\b", "Furniture > Home furniture > Bedding furniture"),
                    (r"office desk|computer desk|study desk", "Furniture > Home furniture > Home office desks"),
                ]
                for pattern, furniture_path in furniture_paths:
                    if furniture_path in paths and re.search(pattern, item["name"], re.I):
                        path = furniture_path
                        break
            # Gendered categories use the source's explicit title/attribute value.
            if len(targets) > 1 and any("Women's" in target or "Men wear" in target for target in targets):
                gender = next((str(a.get("value", "")) for a in item["attributes"] if NORMAL(a.get("name", "")) == "gender"), "")
                haystack = item["name"] + " " + gender
                female = bool(re.search(r"women|female|lady|ladies|girl", haystack, re.I))
                male = bool(re.search(r"\bmen\b|\bmale\b|boy", haystack, re.I))
                gendered = [target for target in targets if
                    (female and ("Women's" in target or "Women's Wear" in target)) or
                    (male and not female and ("Men's" in target or "Men wear" in target))]
                if gendered:
                    path = gendered[index % len(gendered)]
                elif not re.search("unisex", haystack, re.I):
                    continue
            fields, missing = field_values(item, definitions[path])
            if missing:
                missing_counts.update(missing)
                continue
            category_id, root_id = paths[path]
            candidates.append({**item, "productCategoryId": category_id, "rootId": root_id,
                "categoryPath": path, "customFields": fields})
        print(json.dumps({"validCandidates": len(candidates), "missingFields": dict(missing_counts.most_common(12))}), flush=True)
        if len(candidates) >= args.count + 150 or page == 5:
            break

    # Round-robin roots and subcategories so a busy phone category cannot crowd out the others.
    grouped = defaultdict(lambda: defaultdict(deque))
    for item in candidates:
        grouped[item["rootId"]][item["productCategoryId"]].append(item)
    ordered = []
    while grouped:
        for root_id in list(grouped):
            categories = grouped[root_id]
            category_id = next(iter(categories))
            queue = categories.pop(category_id)
            ordered.append(queue.popleft())
            if queue:
                categories[category_id] = queue
            if not categories:
                del grouped[root_id]
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
        "batch": "catalog-20261112", "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source": "Public Jiji Uganda product listings", "items": verified,
        "summary": {
            "items": len(verified), "roots": len({item["rootId"] for item in verified}),
            "subcategories": len({item["productCategoryId"] for item in verified}),
            "photos": len({item["imageUrl"] for item in verified}),
            "categoryCounts": dict(Counter(item["categoryPath"] for item in verified)),
        },
        "sourceErrors": errors,
    }
    Path(args.output).write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(payload["summary"]), flush=True)
    if len(verified) < args.count:
        raise SystemExit("Insufficient validated items; manifest saved for review before seeding.")


if __name__ == "__main__":
    main()
