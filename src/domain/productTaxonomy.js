// Product nodes retain their IDs and custom fields; association is inherited down
// the product tree. Empty associations remain compatible until migration review.
export const lineage = (rows, id) => {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const ids = [];
  while (id && !ids.includes(id)) { ids.push(id); id = byId.get(id)?.parentId; }
  return ids;
};
export const effectiveProviderCategory = (products, id) => {
  const byId = new Map(products.map((r) => [r.id, r]));
  return lineage(products, id).map((key) => byId.get(key)?.providerCategoryId).find(Boolean) ?? null;
};
export const categoryRelated = (directory, a, b) => Boolean(a && b && (lineage(directory, a).includes(b) || lineage(directory, b).includes(a)));
export const categoryWithin = (directory, target, provider) => Boolean(target && provider && lineage(directory, target).includes(provider));
export const scopedProductTree = (tree, directory, providerCategoryId) => {
  const visit = (nodes, inherited = null) => nodes.flatMap((n) => {
    const owner = n.providerCategoryId || inherited;
    const children = visit(n.children || [], owner);
    const allowed = owner && categoryWithin(directory, owner, providerCategoryId);
    return allowed || children.length ? [{...n, effectiveProviderCategoryId: owner, children}] : [];
  });
  return visit(tree);
};

// A category should stay visible to customers if it directly has live listings, or any
// descendant does - a parent category with zero direct listings but a non-empty child must not
// be hidden, since that would hide the child too (there'd be no way to reach it from the tree).
export const idsWithNonEmptyDescendant = (rows, directNonEmptyIds) => {
  const childrenByParent = new Map();
  for (const r of rows) {
    if (!r.parentId) continue;
    if (!childrenByParent.has(r.parentId)) childrenByParent.set(r.parentId, []);
    childrenByParent.get(r.parentId).push(r.id);
  }
  const memo = new Map();
  const visit = (id) => {
    if (memo.has(id)) return memo.get(id);
    memo.set(id, false); // cycle guard - overwritten below once the real result is known
    const result = directNonEmptyIds.has(id) || (childrenByParent.get(id) ?? []).some((childId) => visit(childId));
    memo.set(id, result);
    return result;
  };
  for (const r of rows) visit(r.id);
  return new Set([...memo].filter(([, keep]) => keep).map(([id]) => id));
};

// Drop any node (and with it its whole subtree) whose id isn't in survivingIds - survivingIds
// already folds in non-empty descendants, so a plain membership test at every level is enough.
export const pruneBySurvivingIds = (nodes, survivingIds) =>
  nodes.filter((n) => survivingIds.has(n.id)).map((n) => ({ ...n, children: pruneBySurvivingIds(n.children || [], survivingIds) }));

export const flattenTree = (nodes) => nodes.flatMap((n) => [{ id: n.id, parentId: n.parentId }, ...flattenTree(n.children || [])]);
