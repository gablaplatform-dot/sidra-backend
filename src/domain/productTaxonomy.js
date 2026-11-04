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
