import test from 'node:test';
import assert from 'node:assert/strict';
import {localSearchIntent, refineSearchIntent, rankSearchResults} from '../src/domain/searchIntent.js';
import {AiSearchService} from '../src/services/ai/aiSearch.service.js';
import {ListingService} from '../src/services/listing.service.js';
import {prisma} from '../src/config/db.js';

const rows = [
  {code: 'P1', id: 'laptops', name: 'Laptops & Computers', label: 'Electronics Laptops & Computers'},
  {code: 'P2', id: 'phones', name: 'Mobile Phones', label: 'Phones & Tablets Mobile Phones'},
  {code: 'P3', id: 'shoes', name: "Men's Shoes", label: "Men's Fashion Men's Shoes"},
  {code: 'P4', id: 'electronics', name: 'Electronics', group: true},
];
const catalog = {rows, byCode: new Map(rows.map(row => [row.code, row.id])), text: 'P1 Laptops & Computers\nP2 Mobile Phones\nP3 Shoes'};

function aiService() {
  const service = new AiSearchService({aiSettingsService: {
    runtime: async () => ({enabled: true, apiKey: 'test', model: 'test'}), recordSuccess() {}, recordFailure() {},
  }});
  service._catalog = async () => catalog;
  return service;
}

test('real catalogue construction records object names without mutating source categories', async t => {
  const source = [{id: 'laptops', name: 'Laptops & Computers', parentId: null}];
  for (const model of ['category', 'productCategory', 'serviceCategory']) {
    const original = prisma[model].findMany;
    prisma[model].findMany = async () => source;
    t.after(() => {prisma[model].findMany = original;});
  }
  const service = new AiSearchService({aiSettingsService: {}});
  const actual = await service._catalog();
  assert.equal(source.length, 1);
  assert.equal(actual.rows.length, 3);
  assert.deepEqual(localSearchIntent('I need a laptop', actual.rows).productCategoryIds, ['laptops']);
});

test('ordinary language and MacBook names resolve to actual laptop categories', () => {
  for (const query of ['I need a laptop', 'please show me laptops', 'apple macbook air', 'a notebook for me']) {
    const intent = localSearchIntent(query, rows);
    assert.deepEqual(intent.productCategoryIds, ['laptops']);
    assert.ok(intent.terms.includes('laptop'));
    assert.ok(!intent.productCategoryIds.includes('phones'));
  }
});

test('AI timeout still returns catalogue-backed laptop intent instead of a literal sentence', async () => {
  const service = aiService();
  service._ask = async () => {throw new Error('AI request timed out');};
  assert.deepEqual((await service.expand('I need a laptop')).productCategoryIds, ['laptops']);
});

test('a recognised object never expands a brand or colour into unrelated products', async () => {
  const fallback = localSearchIntent('apple macbook air', rows);
  const intent = refineSearchIntent({terms: ['apple', 'air', 'laptop'], productCategoryIds: ['phones'], serviceCategoryIds: ['electronics'], listingServiceCategoryIds: [], intent: 'Laptops'}, fallback);
  assert.deepEqual(intent.productCategoryIds, ['laptops']);
  assert.ok(!intent.terms.includes('apple'));
  const service = new ListingService();
  service._expandProductCategoryIds = async id => [id];
  const clauses = await service._aiSearchClauses('apple macbook air', intent);
  assert.deepEqual(clauses, [{productCategoryId: {in: ['laptops']}}]);
});

test('vision intent survives into the catalogue request without another AI call', async t => {
  const service = aiService();
  const requests = t.mock.method(globalThis, 'fetch', async () => ({ok: true, json: async () => ({content: [{type: 'text', text: '{"query":"apple macbook air","intent":"Laptops","terms":["laptop","macbook"],"categories":["P1"]}'}]})}));
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  await service.describeImage({buffer: png, contentType: 'image/png'});
  const expanded = await service.expand('apple macbook air');
  assert.deepEqual(expanded.productCategoryIds, ['laptops']);
  assert.equal(expanded.fromPhoto, true);
  assert.equal(requests.mock.callCount(), 1);
});

test('the public listings endpoint actually calls the AI service and keeps explicit filters', async () => {
  const intent = localSearchIntent('I need a laptop', rows);
  const seen = [];
  const service = new ListingService({aiSearchService: {expand: async query => {seen.push(query);return intent;}}});
  let forwarded;
  service._publicList = async args => {forwarded = args; return {items: [], total: 0};};
  await service.publicList({q: 'I need a laptop', type: 'product', minPrice: 100, maxPrice: 300, productCategoryId: 'selected', attrs: '{"brand":["HP"]}'});
  assert.deepEqual(seen, ['I need a laptop']);
  assert.equal(forwarded.ai, intent);
  assert.equal(forwarded.productCategoryId, 'selected');
  assert.equal(forwarded.maxPrice, 300);
  assert.equal(forwarded.attrs, '{"brand":["HP"]}');
});

test('exact models, other laptops and category-only desktops stay in that order across pages', async t => {
  const source = [
    {id: 'desktop', name: 'Dell desktop computer', productCategoryId: 'laptops'},
    {id: 'hp', name: 'HP EliteBook laptop', productCategoryId: 'laptops'},
    {id: 'mac', name: 'Apple MacBook Pro', productCategoryId: 'laptops'},
    {id: 'air', name: 'Apple MacBook Air', productCategoryId: 'laptops'},
  ];
  const ai = localSearchIntent('apple macbook air', rows);
  assert.deepEqual(rankSearchResults(source, 'apple macbook air', ai).map(row => row.id), ['air', 'mac', 'hp', 'desktop']);
  const original = prisma.serviceProduct.findMany;
  prisma.serviceProduct.findMany = async args => args.select ? source : source.filter(row => args.where.id.in.includes(row.id)).reverse();
  t.after(() => {prisma.serviceProduct.findMany = original;});
  const service = new ListingService();
  const args = {filter: {status: 'approved'}, attrs: {}, sort: 'discovery', seed: 'test', q: 'apple macbook air', ai, take: 2};
  const first = await service._fetchPage({...args, skip: 0});
  const second = await service._fetchPage({...args, skip: 2});
  assert.deepEqual([...first.items, ...second.items].map(row => row.id), ['air', 'mac', 'hp', 'desktop']);
});

test('filter counts use the same AI intent as the product grid', async t => {
  const intent = localSearchIntent('I need a laptop', rows);
  const service = new ListingService({aiSearchService: {expand: async () => intent}});
  let captured;
  service._buildPublicFilter = async args => {captured = args;return {status: 'approved'};};
  const original = prisma.serviceProduct.findMany;
  prisma.serviceProduct.findMany = async () => [];
  t.after(() => {prisma.serviceProduct.findMany = original;});
  const result = await service.facets({q: 'I need a laptop', type: 'product'});
  assert.equal(captured.ai, intent);
  assert.equal(result.total, 0);
});
