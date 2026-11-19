import { test } from "node:test";
import assert from "node:assert/strict";
import { discoveryOrder } from "../src/domain/discoveryOrder.js";
import { ListingService } from "../src/services/listing.service.js";
import { prisma } from "../src/config/db.js";

const products = (counts) => Object.entries(counts).flatMap(([category, count]) =>
  Array.from({ length: count }, (_, index) => ({
    id: `${category}-${index}`, productCategoryId: category,
  })));

test("discovery is seeded, repeatable, and alternates categories across page boundaries", () => {
  const input = products({ phones: 40, laptops: 12, cameras: 9 });
  const ordered = discoveryOrder(input, "visitA");
  assert.deepEqual(ordered, discoveryOrder([...input].reverse(), "visitA"));
  assert.notDeepEqual(ordered, discoveryOrder(input, "visitB"));
  assert.equal(new Set(ordered.map((item) => item.id)).size, input.length);
  const remaining = new Map(Object.entries({ phones: 40, laptops: 12, cameras: 9 }));
  for (let index = 0; index < ordered.length; index++) {
    const item = ordered[index];
    if (index && ordered[index - 1].productCategoryId === item.productCategoryId) {
      assert.equal([...remaining].some(([category, count]) => category !== item.productCategoryId && count > 0), false);
    }
    remaining.set(item.productCategoryId, remaining.get(item.productCategoryId) - 1);
  }
  const pages = Array.from({ length: Math.ceil(ordered.length / 24) }, (_, index) =>
    discoveryOrder(input, "visitA").slice(index * 24, (index + 1) * 24));
  assert.deepEqual(pages.flat(), ordered);
  assert.deepEqual(discoveryOrder([], "visitA"), []);
});

test("discovery paginates after attribute filtering and keeps the public scope on hydration", async () => {
  const source = products({ phones: 25, laptops: 25 }).map((item, index) => ({
    ...item, customFields: { condition: index % 2 ? "New" : "Used" },
  }));
  const original = prisma.serviceProduct.findMany;
  const calls = [];
  prisma.serviceProduct.findMany = async (query) => {
    calls.push(query);
    if (query.select) return source;
    return source.filter((item) => query.where.id.in.includes(item.id)).reverse();
  };
  try {
    const service = new ListingService();
    const filter = { status: "approved", provider: { isApproved: true } };
    const first = await service._fetchPage({
      filter, attrs: { condition: ["New"] }, sort: "discovery",
      seed: "visitA", skip: 0, take: 24,
    });
    const second = await service._fetchPage({
      filter, attrs: { condition: ["New"] }, sort: "discovery",
      seed: "visitA", skip: 24, take: 24,
    });
    assert.equal(first.total, 25);
    assert.equal(second.total, 25);
    assert.equal(first.items.length, 24);
    assert.equal(second.items.length, 1);
    assert.equal(new Set([...first.items, ...second.items].map((item) => item.id)).size, 25);
    assert(first.items.every((item) => item.customFields.condition === "New"));
    for (const query of calls) {
      assert.equal(query.where.status, "approved");
      assert.deepEqual(query.where.provider, filter.provider);
    }
    assert.deepEqual(first.items.map((item) => item.id),
      discoveryOrder(source.filter((item) => item.customFields.condition === "New"), "visitA").slice(0, 24).map((item) => item.id));
  } finally {
    prisma.serviceProduct.findMany = original;
    await prisma.$disconnect();
  }
});

test("related products keep the same subcategory first and fill from siblings", async () => {
  const originalFind = prisma.serviceProduct.findUnique;
  const originalMany = prisma.serviceProduct.findMany;
  const originalCategory = prisma.productCategory.findUnique;
  const base = {
    id: "base", status: "approved", type: "product",
    productCategoryId: "phones", price: 100,
    customFields: { brand: "A" }, provider: {},
  };
  const same = {
    ...base, id: "same", price: 1,
    customFields: {}, createdAt: new Date("2020-01-01"),
  };
  const sibling = {
    ...base, id: "sibling", productCategoryId: "laptops",
    featured: true, soldCount: 10, createdAt: new Date(),
  };
  prisma.serviceProduct.findUnique = async () => base;
  prisma.productCategory.findUnique = async () => ({ parentId: "electronics" });
  prisma.serviceProduct.findMany = async (query) =>
    query.where.productCategoryId === "phones" ? [same] : [sibling];
  try {
    const service = new ListingService();
    service._expandProductCategoryIds = async () => ["electronics", "phones", "laptops"];
    const result = await service.similar({ listingId: "base", limit: 8 });
    assert.deepEqual(result.items.map((item) => item.id), ["same", "sibling"]);
    assert.equal(result.total, 2);
  } finally {
    prisma.serviceProduct.findUnique = originalFind;
    prisma.serviceProduct.findMany = originalMany;
    prisma.productCategory.findUnique = originalCategory;
    await prisma.$disconnect();
  }
});
