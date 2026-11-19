const normalize = value => String(value ?? '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
const singular = word => word.endsWith('sses') ? word.slice(0, -2) : word.length > 3 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word;
const stop = new Set('i im a an the need want looking buy find for please some show me would like to get near around something good nice new used help can you'.split(' '));
export const searchWords = value => normalize(value).split(' ').map(singular).filter(word => word.length > 1 && !stop.has(word));
const kinds = [
  ['laptop', 'notebook', 'macbook'], ['phone', 'smartphone', 'mobile phone', 'iphone'],
  ['television', 'tv'], ['shoe', 'sneaker', 'trainer', 'footwear'],
  ['headphone', 'earphone', 'earbud', 'airpod'], ['tablet', 'ipad'],
  ['fridge', 'refrigerator'], ['sofa', 'couch'], ['car', 'vehicle'],
  ['bicycle', 'bike'], ['shirt', 't shirt', 'tshirt'], ['dress', 'gown'],
  ['clothing', 'clothes', 'apparel'], ['bag', 'handbag', 'backpack'],
  ['camera', 'camcorder'], ['watch', 'wristwatch'], ['bed', 'bedframe'],
  ['food', 'meal', 'restaurant', 'eat', 'hungry'],
];
const hasPhrase = (text, phrase) => ` ${text} `.includes(` ${phrase} `);

// A catalogue-backed fallback, not a second AI call. Common object names still
// work when the AI times out; a MacBook must never require an exact full title.
export function localSearchIntent(query, rows = []) {
  const words = searchWords(query);
  const normalized = words.join(' ');
  const kind = kinds.find(group => group.some(term => hasPhrase(normalized, searchWords(term).join(' '))));
  const needles = new Set([...words, ...(kind ?? []).flatMap(searchWords)]);
  const scored = rows.filter(row => !row.group).map(row => ({...row,
    score: [...new Set(searchWords(row.label ?? row.name))].filter(word => needles.has(word)).length,
  })).filter(row => row.score > 0);
  const best = Math.max(0, ...scored.map(row => row.score));
  const matched = scored.filter(row => row.score === best);
  const ids = prefix => [...new Set(matched.filter(row => row.code.startsWith(prefix)).map(row => row.id))].slice(0, 6);
  const terms = kind ?? (matched.length ? words : []);
  const productCategoryIds = ids('P');
  return {terms: terms.filter(term => term.length <= 32).slice(0, 8),
    productCategoryIds, serviceCategoryIds: kind && productCategoryIds.length ? [] : ids('S'), listingServiceCategoryIds: kind && productCategoryIds.length ? [] : ids('V'),
    intent: matched.find(row => row.code.startsWith('P'))?.name ?? matched[0]?.name ?? '',
    objectTerms: kind ?? [],
  };
}

export function refineSearchIntent(value, fallback) {
  if (!value) return fallback;
  if (!fallback.objectTerms.length) return value;
  const objectTerms = fallback.objectTerms;
  const terms = [...new Set([...objectTerms, ...value.terms.filter(term => objectTerms.some(object =>
    hasPhrase(searchWords(term).join(' '), object)))])].slice(0, 8);
  return {...value, terms, objectTerms,
    // Broad business-category matches must not pull printers or phones into a
    // specific object search just because the same shop sells those as well.
    productCategoryIds: fallback.productCategoryIds.length ? fallback.productCategoryIds : value.productCategoryIds,
    serviceCategoryIds: fallback.productCategoryIds.length ? [] : value.serviceCategoryIds,
    listingServiceCategoryIds: fallback.productCategoryIds.length ? [] : value.listingServiceCategoryIds,
  };
}

// Rank BEFORE slicing pages. Exact model/name matches come first, followed by
// matching words and then category-only relatives. Ties keep the seeded ordering.
export function rankSearchResults(items, query, ai, itemOf = item => item) {
  if (!String(query ?? '').trim()) return items;
  const phrase = normalize(query), words = searchWords(query);
  const score = entry => {
    const name = normalize(itemOf(entry).name);
    const nameWords = new Set(searchWords(name));
    return (name.includes(phrase) ? 1000 : 0) +
      words.filter(word => nameWords.has(word)).length * 20 +
      (ai?.terms ?? []).filter(term => searchWords(term).every(word => nameWords.has(word))).length * 2;
  };
  return items.map((item, index) => ({item, index, score: score(item)}))
    .sort((a, b) => b.score - a.score || a.index - b.index).map(row => row.item);
}
