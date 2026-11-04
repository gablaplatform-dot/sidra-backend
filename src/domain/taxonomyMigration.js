import { lineage } from './productTaxonomy.js';
const key = (v) => String(v).trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ');
export function buildTaxonomyPlan({categories, products, usage = [], mapping = {}}) {
  return products.filter((p) => !p.parentId).map((root) => {
    if (root.providerCategoryId) return {productCategoryId:root.id,name:root.name,action:'linked',providerCategoryId:root.providerCategoryId};
    if (mapping[root.id]) {
      if (!categories.some((c) => c.id === mapping[root.id] && c.isActive !== false)) throw new Error(`Invalid mapping for ${root.id}`);
      return {productCategoryId:root.id,name:root.name,action:'link',providerCategoryId:mapping[root.id],reason:'explicit mapping'};
    }
    const used = [...new Set(usage.filter((u) => lineage(products,u.productCategoryId).includes(root.id)).map((u) => u.providerCategoryId).filter(Boolean))];
    const exact = categories.filter((c) => key(c.name) === key(root.name) && c.isActive !== false);
    const target = used.length === 1 ? used[0] : used.length === 0 && exact.length === 1 ? exact[0].id : null;
    if (target) return {productCategoryId:root.id,name:root.name,action:'link',providerCategoryId:target,reason:used.length ? 'existing listing/business relationship' : 'unique exact name'};
    if (used.length > 1 || exact.length > 1) return {productCategoryId:root.id,name:root.name,action:'review',candidates:[...new Set([...used,...exact.map((c)=>c.id)])]};
    return {productCategoryId:root.id,name:root.name,action:'create-business-category',parent:'Shop'};
  });
}
