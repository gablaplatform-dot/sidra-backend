import { createHash } from "node:crypto";

const rank = (seed, value) => createHash("sha256").update(seed).update("\0").update(value).digest("hex");

// Stable within a session, varied across sessions, and interleaved before pagination.
export function discoveryOrder(items, seed, itemOf = (item) => item) {
  const groups = new Map();
  for (const item of items) {
    const product = itemOf(item);
    const key = product.productCategoryId ?? product.serviceCategoryId ?? "";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ item, rank: rank(seed, product.id) });
  }
  const queues = [...groups].map(([key, products]) => ({
    rank: rank(seed, key),
    products: products.sort((a, b) => a.rank.localeCompare(b.rank)),
    offset: 0,
  })).sort((a, b) => a.rank.localeCompare(b.rank));
  const ordered = [];
  while (queues.length) {
    for (let index = 0; index < queues.length;) {
      const queue = queues[index];
      ordered.push(queue.products[queue.offset++].item);
      if (queue.offset === queue.products.length) queues.splice(index, 1);
      else index++;
    }
  }
  return ordered;
}
