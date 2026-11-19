"""Audit and fill catalogue gaps using source categories and explicit item facts.

Never randomly choose a gender or assign a narrow category merely to meet a quota.
Unknown specifications stay absent; source attributes are retained as provenance.
"""
import argparse
import collections
import concurrent.futures
import hashlib
import html
import json
import re
import time
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from urllib.parse import quote
import collect

ROOT = Path(__file__).resolve().parent
CACHE = collect.CACHE
AUDIT = json.loads(Path('/tmp/gabla-catalog-audit.json').read_text())
BY_ID = {c['id']: c for c in AUDIT['shop']}
PATHS, DEFINITIONS = {}, {}
for row in BY_ID.values():
    chain, node = [], row
    while node:
        chain.insert(0, node)
        node = BY_ID.get(node['parentId'])
    if any(not c['isActive'] for c in chain):
        continue
    path = ' > '.join(c['name'] for c in chain)
    PATHS[path] = (row['id'], chain[0]['id'])
    fields = {}
    for c in chain:
        fields.update({f['key']: f for f in c['listingFields']})
    DEFINITIONS[path] = list(fields.values())
PARENTS = {c['parentId'] for c in BY_ID.values()}
LEAVES = {path for path, (cid, _) in PATHS.items() if cid not in PARENTS}
LINKS = json.loads(Path('/tmp/gabla-source-category-links.json').read_text())
LINKS.update({'land-and-plots-for-rent': 'Land & Plots for Rent',
              'business-for-sale-and-investment': 'Business for Sale & Investment',
              'wholesale-and-bulk': 'Wholesale & Bulk'})
SLUG_TO_PATHS = collections.defaultdict(list)
for slug, label in LINKS.items():
    for path in LEAVES:
        if collect.NORMAL(label) == collect.NORMAL(path.split(' > ')[-1]):
            SLUG_TO_PATHS[slug].append(path)
for slug, label in [('clothing', 'Clothing'), ('shoes', 'Shoes'), ('accessories', 'Clothing Accessories'),
                    ('bags', 'Bags'), ('jewellery-and-watches', 'Jewelry'), ('watches', 'Watches'),
                    ('wedding-wear', 'Wedding Wear & Accessories')]:
    for path in LEAVES:
        leaf = path.split(' > ')[-1].replace("Women's ", '').replace("Men's ", '')
        if leaf == label and path.startswith('Fashion >') and path not in SLUG_TO_PATHS[slug]:
            SLUG_TO_PATHS[slug].append(path)

# Legacy administrator-created categories have real names rather than identical source slugs.
SPECIAL = {
    'mobile-phones': ['Electronics > Mobile phones and tables'],
    'computers-and-laptops': ['Electronics > Computing and office equipment'],
    'tv-dvd-equipment': ['Electronics > Tv'],
    'smart-watches': ['Electronics > Smart wearables'],
    'cameras-video-cameras-and-accessories': ['Electronics > Camera and photography'],
    'clothing': ["Fashion and Apparels > Women's Wear > Clothing", 'Fashion and Apparels > Men wear > Clothing'],
    'shoes': ["Fashion and Apparels > Women's Wear > Shoe's", "Fashion and Apparels > Men wear > Shoe's"],
    'accessories': ["Fashion and Apparels > Women's Wear > Accessories", 'Fashion and Apparels > Men wear > Accessories'],
}
for slug, paths in SPECIAL.items():
    SLUG_TO_PATHS[slug].extend(path for path in paths if path in LEAVES)

FURNITURE = {
 'Seating furniture': r'\bsofa|\bcouch|\brecliner|\barmchair|\bseater|\bstool|\bchair|\bbench',
 'Tables furniture': r'dining table|dining set|coffee table|centre table|center table|side table|console table|bed table|bed said table|bedside table|nightstand',
 'Storage furniture': r'wardrobe|cabinet|cupboard|\bshelf|\bshelves|shoe rack|chest of drawers',
 'Bedding furniture': r'\bbed\b|mattress|headboard|bunk bed',
 'Home office desks': r'office desk|computer desk|study desk|writing desk|study table|computer table|office table|\bdesk\b',
 'Office furniture': r'office|executive|reception|workstation|conference|boardroom|gaming chair|computer chair',
 'Hospitality furniture': r'restaurant|hotel|bar stool|bar chair|banquet|cafe|cafeteria',
 'Retail furniture': r'display|shop counter|retail|showcase|supermarket|boutique|store shelf|shelves for shop',
 'Educational furniture': r'school|student|classroom|pupil|library|kindergarten|nursery desk',
 'Healthcare furniture': r'hospital|medical|examination|clinic|patient|delivery bed|dental chair',
 'Transit furniture': r'airport|waiting bench|waiting chair|public seating|terminal seating|visitor bench',
}
ELECTRICAL = {
 'Generators': r'\bgenerator', 'Solar & Renewable': r'\bsolar',
 'Inverters & Backup Batteries': r'inverter|backup batter|\bups\b',
 'Switches, Sockets & Distribution': r'switch|socket|distribution|circuit breaker|consumer unit',
 'Stabilizers & Voltage Protection': r'stabili[sz]er|voltage|surge protect',
 'Welding Machinery & Construction': r'weld|solder',
 'Industrial Electrical & Automation': r'contactor|industrial|automation|motor starter|electric motor|frequency drive|\bvfd\b',
 'Electronic Components & Sensors': r'sensor|capacitor|resistor|transistor|arduino|electronic component|relay module|breadboard|microcontroller|\besp32\b|\besp-?01\b|wifi module',
 'Cables & Wires': r'\bcable|\bwire',
}

def attrs(item):
    return {collect.NORMAL(a.get('name', '')): a.get('value') for a in item['attributes'] if a.get('name')}

def eligible(item):
    slug, title = item['sourceSlug'], item['name']
    candidates = list(SLUG_TO_PATHS.get(slug, []))
    if slug in ('furniture', 'childrens-furniture', 'medical-equipment', 'store-equipments', 'restaurant-and-catering-equipment'):
        professional = []
        for path in LEAVES:
            if path.startswith('Furniture >') and re.search(FURNITURE.get(path.split(' > ')[-1], r'(?!)'), title, re.I):
                if path.endswith('Home office desks') and (slug == 'childrens-furniture' or re.search(r'\bkids|\bchild|\bschool|\bpupil|classroom', title, re.I)):
                    continue
                candidates.append(path)
                if path.split(' > ')[-1] in ('Healthcare furniture', 'Educational furniture', 'Retail furniture', 'Transit furniture', 'Office furniture'):
                    professional.append(path)
        if professional:
            candidates = [p for p in candidates if (not p.startswith('Furniture > Home furniture') or p.endswith('Home office desks'))
                          and p != 'Home, Furniture & Appliances > Furniture']
        if re.search(r'bedside|bed said|bed side|bed table|nightstand|night stand', title, re.I):
            candidates = [p for p in candidates if not p.endswith('Bedding furniture')]
            leaf = 'Storage furniture' if re.search(r'drawer|drower|cabinet|locker', title, re.I) else 'Tables furniture'
            candidates.extend(p for p in LEAVES if p == 'Furniture > Home furniture > ' + leaf)
        if re.search(r'dining set', title, re.I):
            candidates = [p for p in candidates if not p.endswith('Seating furniture')]
    if slug in ('power-equipments', 'electrical-equipment', 'electricals', 'electronic-components', 'solar-energy-products', 'hand-and-power-tools', 'power-tools', 'accessories-and-supplies-for-electronics', 'manufacturing-materials-and-tools', 'manufacturing-equipments'):
        for path in LEAVES:
            if path.startswith('Repair & Construction > Electrical Equipment >') and re.search(ELECTRICAL[path.split(' > ')[-1]], title, re.I):
                candidates.append(path)
    if slug in ('security-and-surveillance', 'accessories-and-supplies-for-electronics', 'home-appliances', 'power-equipments'):
        if re.search(r'smart (?:plug|socket|switch|lock|home|bulb)|wi-?fi (?:plug|socket|switch)|home automation|alexa|google home', title, re.I):
            candidates.append('Electronics > Smart home devices')
    if slug == 'business-for-sale-and-investment':
        if re.search(r'franchise|dealership', title, re.I):
            candidates.append('Business & Industry > Business for Sale & Investment > Franchise & Dealership')
        elif re.search(r'investor|partner|shares', title, re.I):
            candidates.append('Business & Industry > Business for Sale & Investment > Investor/Partner Wanted')
        elif re.search(r'for sale|on sale|business|salon|pharmacy|boutique|shop|restaurant', title, re.I) and not re.search(r'bank note|colnect|\bchair\b|fishing nets', title, re.I):
            candidates.append('Business & Industry > Business for Sale & Investment > Running Business for Sale')
    if slug == 'feeds-supplements-seeds':
        if re.search(r'construction foundation|building foundation', title, re.I):
            candidates = ['Repair & Construction > Other Repair & Construction Items']
        elif re.search(r'snake repell|monkey repell|ant hills', title, re.I):
            candidates = ['Home, Furniture & Appliances > Garden Supplies']
        elif re.search(r'bedbug|cockroach|ant.killer|ants|bats|mosquito', title, re.I):
            candidates = ['Home, Furniture & Appliances > Household Chemicals']
        # These two source photos were reviewed: both are clearly labelled seed packs.
        elif item.get('sourceId') in ('8697180', '8207826') or re.search(r'seed|seedling|fertili|\bplant|\bf1\b|hybrid|pesticide|herbicide|glyphosate|\burea\b|\bnpk\b|fungicide|insecticide|24d.amine|\bsoil\b|manure|compost|\blawn\b|sapling|rooting|ammonium|potassium|agricultural lime|weedmaster|weedall', title, re.I):
            candidates = ['Food, Agriculture & Farming > Seeds & Fertilizers']
        elif re.search(r'feed|poultry|livestock|sunflower cake|soya meal|soybean meal', title, re.I):
            candidates = ['Food, Agriculture & Farming > Farm Animal Feed & Supplements']
        elif re.search(r'onion|sweet|candy|\bsugar\b|\brice\b|\bbeans\b|\bmaize\b|\bflour\b|cooking oil|groundnut', title, re.I):
            candidates = ['Food, Agriculture & Farming > Food & Beverages']
        else:
            candidates = []
    if slug in ('land-and-plots-for-rent', 'land-and-plots-for-sale', 'houses-apartments-for-rent', 'houses-apartments-for-sale'):
        for_sale = bool(re.search(r'for sale|on sale', title, re.I))
        for_rent = bool(re.search(r'for rent|for lease|leasing', title, re.I))
        if for_sale and not for_rent:
            candidates = ['Property > Land & Plots For Sale' if 'land-and-plots' in slug else 'Property > Houses & Apartments For Sale']
        elif for_rent and not for_sale:
            candidates = ['Property > Land & Plots for Rent' if 'land-and-plots' in slug else 'Property > Houses & Apartments For Rent']
    # Body lotion and facial serum must not be interchanged just because a source seller
    # posted them in a broad skincare category.
    if slug in ('skin-care', 'bath-body'):
        if re.search(r'\bbody|\bhand cream|\bshower|\bbath|\bsoap|\bdeodorant|\blotion', title, re.I) and not re.search(r'facial|\bface\b', title, re.I):
            candidates = ['Beauty & Personal Care > Body Care']
        elif re.search(r'face|facial|serum|cleanser|toner|acne|retinol|sunscreen|eye cream|mud mask', title, re.I):
            candidates = ['Beauty & Personal Care > Face Care']
        else:
            candidates = ['Beauty & Personal Care > Face Care' if slug == 'skin-care' else 'Beauty & Personal Care > Body Care']
    if slug == 'shoes' and re.search(r'shoe cover|shoe polish|shoe cleaner|shoe rack|shoe bag|shoe box|insole|shoe lace|shoelace', title, re.I):
        candidates = SLUG_TO_PATHS['accessories'][:]
    if slug == 'accessories' and re.search(r'renovation|shoe polish|shoe cleaner|washing|perfume|shampoo|\bcream\b', title, re.I):
        return []
    if slug == 'accessories' and re.search(r'travel pillow|towel robe|hair cap set', title, re.I):
        return []
    if slug == 'accessories' and re.search(r'body shaper|waist trainer|tummy pants|shaper of waist|abdomen tightening', title, re.I):
        candidates = SLUG_TO_PATHS['clothing'][:]
    if slug == 'jewellery-and-watches' and re.search(r'organis|organiz|jewell?ery box|display|jewell?ery stand|storage', title, re.I):
        return []
    if slug in ('clothing', 'shoes', 'accessories', 'jewellery-and-watches') and re.search(r'bridal|bridesmaid|wedding|bouquet|groom|engagement|cufflink|bow tie|tuxedo', title, re.I):
        candidates.extend(p for p in LEAVES if p.startswith('Fashion >') and 'Wedding Wear' in p)
    gender = str(attrs(item).get('gender', '')).lower()
    # Some source sellers label every listing Unisex, even women's lingerie. Cross-check
    # that broad label against explicit product names; never put a dress or bra in menswear.
    female_name = bool(re.search(r"\bwomen|\bladies|\blady\b|\bfemale|\bgirls|\bdress\b(?!\s+shirts?)|\bdresses\b|\bskirt|\bblouse|\bbra\b|\bbras\b|\bbustier|\bcamisole|\bshapewear|\blingerie|\bbabydoll|\bnightgown|\bheels\b", title, re.I))
    male_name = bool(re.search(r"\bmen(?:'s)?\b|\bmale\b|\bboys", title, re.I))
    female = gender in ("women's", 'women', 'female', 'girls') or (female_name and not male_name)
    # Original photo reviewed manually: the source's Unisex tag is incorrect for this
    # women's satin sleepwear set. Keep the original source attributes in provenance.
    if item.get('sourceId') == '5852249':
        female = True
    conflict = ((female_name and not male_name and gender in ("men's", 'men', 'male')) or
                (male_name and not female_name and gender in ("women's", 'women', 'female')))
    if conflict:
        candidates = [p for p in candidates if not ("Women's" in p or "Men's" in p or 'Men wear' in p)]
    male = (gender in ("men's", 'men', 'male', 'boys', 'unisex') or male_name) and not female
    shared_accessory = (slug == 'accessories' and gender == 'unisex' and not male_name and
                        bool(re.search(r'scrunchie|hair ?clip|hair ?band|headband|scarf|glove|sunglass|glasses|umbrella|\bhat\b|\bcap\b', title, re.I)))
    result = []
    for path in set(candidates):
        if path not in LEAVES:
            continue
        female_accessories = (path.endswith("Women's Clothing Accessories") or
                              path == "Fashion and Apparels > Women's Wear > Accessories")
        if ("Women's" in path) and not female and not (female_accessories and shared_accessory):
            continue
        if ("Men's" in path or 'Men wear' in path) and not male:
            continue
        # Distinguish accessories sold by an event vendor from actual apparel etc.
        if 'Wedding Wear' in path and not re.search(r'bridal|bridesmaid|wedding|bouquet|groom|engagement|cufflink|bow tie|tuxedo', title, re.I):
            continue
        result.append(path)
    return sorted(result)

def fetch_cached_or_public(slug, page, online):
    cache = CACHE / (slug + '-' + str(page) + '.html')
    if not cache.exists() and not online:
        return [], None
    if not cache.exists():
        time.sleep(2.1)
    rows, error = collect.fetch_page((slug, [], page))
    for item in rows:
        detail = CACHE / ('detail-' + item['sourceId'] + '.json')
        if detail.exists():
            item['attributes'] = json.loads(detail.read_text())
    return rows, error

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--online', action='store_true')
    parser.add_argument('--target', type=int, default=12)
    args = parser.parse_args()
    collected, errors = {}, []
    # Fetch only the public categories relevant to an actual Gabla category.
    slugs = set(SLUG_TO_PATHS) | {'furniture', 'power-equipments', 'business-for-sale-and-investment'}
    for slug in sorted(slugs):
        for page in [1, 2, 3]:
            rows, error = fetch_cached_or_public(slug, page, args.online and page == 1)
            if error:
                errors.append(error)
                if '429' in error['error'] or '403' in error['error']:
                    print(json.dumps({'sourcePaused': error}), flush=True)
                    args.online = False
            for row in rows:
                collected.setdefault(row['sourceUrl'], row)
        print(json.dumps({'source': slug, 'candidates': len(collected)}), flush=True)
    for cache in sorted(CACHE.glob('search?query=*.html')):
        match = re.match(r'(.+)-(\d+)\.html$', cache.name)
        if not match:
            continue
        slug, page = match[1], int(match[2])
        rows, error = collect.fetch_page((slug, [], page, True))
        if error:
            errors.append(error)
        for row in rows:
            collected.setdefault(row['sourceUrl'], row)
    for row in collected.values():
        detail = CACHE / ('detail-' + row['sourceId'] + '.json')
        if detail.exists():
            row['attributes'] = json.loads(detail.read_text())
    original = json.loads((ROOT / 'catalog-20261112.json').read_text())['items']
    original_by_url = {i['sourceUrl']: i for i in original}
    for item in original:
        collected.setdefault(item['sourceUrl'], item)
    counts = collections.Counter()
    # Preserve other people's live listings without reclassifying or editing them.
    owned_ids = {r['id'] for r in AUDIT['listings'] if r['media'].get('seedBatch') == 'catalog-20261112'}
    id_to_path = {cid: path for path, (cid, _) in PATHS.items()}
    for row in AUDIT['listings']:
        if row['id'] not in owned_ids and row['status'] == 'approved':
            path = id_to_path.get(row['productCategoryId'])
            if path:
                counts[path] += 1
    selected, corrections, rejected = [], [], []
    used_images = {i['imageUrl'] for i in original}
    used_urls = set(original_by_url)
    def prepare(item, path):
        cid, root = PATHS[path]
        fields, missing = collect.field_values(item, DEFINITIONS[path])
        return {**item, 'categoryPath': path, 'productCategoryId': cid, 'rootId': root,
                'customFields': fields, 'unverifiedRequiredFields': missing}
    for item in original:
        source = collected[item['sourceUrl']]
        choices = eligible(source)
        old = item['categoryPath']
        if old in choices:
            counts[old] += 1
            continue
        if not choices:
            # Unclear source classification is withheld, not moved to an arbitrary category.
            rejected.append({'sourceUrl': item['sourceUrl'], 'name': item['name'], 'oldCategory': old})
            continue
        path = min(choices, key=lambda p: (counts[p], p))
        fixed = prepare(source, path)
        fixed['previousCategoryId'] = item['productCategoryId']
        corrections.append(fixed)
        counts[path] += 1
    queues = collections.defaultdict(list)
    for item in collected.values():
        if item['sourceUrl'] in used_urls:
            continue
        for path in eligible(item):
            queues[path].append(item)
    while True:
        pending = [p for p in sorted(LEAVES, key=lambda p: (counts[p], p)) if counts[p] < args.target and queues[p]]
        if not pending:
            break
        batch = []
        for path in pending:
            while queues[path]:
                item = queues[path].pop(0)
                if item['sourceUrl'] in used_urls or item['imageUrl'] in used_images:
                    continue
                used_urls.add(item['sourceUrl'])
                used_images.add(item['imageUrl'])
                batch.append((item, path))
                break
        if not batch:
            break
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            results = list(pool.map(collect.validate_image, [i for i, _ in batch]))
        for result, (_, path) in zip(results, batch):
            if result:
                selected.append(prepare(result, path))
                counts[path] += 1
        print(json.dumps({'newVerified': len(selected), 'categoriesAtTarget': sum(counts[p] >= args.target for p in LEAVES)}), flush=True)
    gaps = [{'category': p, 'count': counts[p], 'needed': max(0, args.target - counts[p]), 'candidatesRemaining': len(queues[p])} for p in sorted(LEAVES) if counts[p] < args.target]
    payload = {'batch': 'catalog-coverage-20261112', 'target': args.target,
        'createdAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'items': selected, 'corrections': corrections, 'withhold': rejected,
        'summary': {'newItems': len(selected), 'corrections': len(corrections), 'withheld': len(rejected),
                    'activeLeaves': len(LEAVES), 'leavesAtTarget': sum(counts[p] >= args.target for p in LEAVES),
                    'categoryCounts': dict(sorted(counts.items()))},
        'gaps': gaps, 'sourceErrors': errors}
    (ROOT / 'coverage-20261112.json').write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k:v for k,v in payload['summary'].items() if k != 'categoryCounts'}), flush=True)

if __name__ == '__main__':
    main()
