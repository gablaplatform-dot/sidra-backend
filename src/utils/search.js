const normalize = (value) =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokenize = (value) => normalize(value).split(" ").filter(Boolean);

// Bounded Levenshtein distance — returns maxDistance + 1 as soon as it can no longer beat it,
// so short-word typo checks stay cheap even scored against long strings.
const levenshtein = (a, b, maxDistance) => {
  if (a === b) return 0;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > maxDistance) return maxDistance + 1;

  let prev = Array.from({ length: lb + 1 }, (_, i) => i);
  for (let i = 1; i <= la; i += 1) {
    const curr = [i];
    let rowMin = curr[0];
    for (let j = 1; j <= lb; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      rowMin = Math.min(rowMin, curr[j]);
    }
    if (rowMin > maxDistance) return maxDistance + 1;
    prev = curr;
  }
  return prev[lb];
};

const tokenMatchScore = (queryToken, targetToken) => {
  if (!queryToken || !targetToken) return 0;
  if (queryToken === targetToken) return 1;
  if (targetToken.startsWith(queryToken) || queryToken.startsWith(targetToken)) return 0.85;

  const maxDistance = queryToken.length <= 4 ? 1 : 2;
  const distance = levenshtein(queryToken, targetToken, maxDistance);
  if (distance > maxDistance) return 0;
  return Math.max(0, 0.7 - distance * 0.2);
};

// Scores how well `text` answers `query`: 0 (no match) to ~1+ (strong/exact match).
// Combines a whole-string substring bonus with best-effort per-token fuzzy matching so
// typos ("carwsh") and partial words ("wash") both surface results.
const textScore = (query, text) => {
  const normalizedQuery = normalize(query);
  const normalizedText = normalize(text);
  if (!normalizedQuery || !normalizedText) return 0;

  let score = 0;
  if (normalizedText === normalizedQuery) score += 1.5;
  else if (normalizedText.includes(normalizedQuery)) score += 1;

  const queryTokens = tokenize(query);
  const targetTokens = tokenize(text);
  if (queryTokens.length && targetTokens.length) {
    const perToken = queryTokens.map((qt) => Math.max(0, ...targetTokens.map((tt) => tokenMatchScore(qt, tt))));
    score += perToken.reduce((sum, s) => sum + s, 0) / queryTokens.length;
  }

  // Round away floating-point noise (e.g. 0.7 - 0.2 = 0.49999999999999994) so scores land
  // exactly on the thresholds callers compare against.
  return Math.round(score * 1000) / 1000;
};

const bestScore = (query, texts) => Math.max(0, ...texts.filter(Boolean).map((t) => textScore(query, t)));

export { normalize, tokenize, levenshtein, tokenMatchScore, textScore, bestScore };
