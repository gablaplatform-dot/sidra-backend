import test from 'node:test';
import assert from 'node:assert/strict';
import {SearchService} from '../src/services/search.service.js';
import {prisma} from '../src/config/db.js';

const categories = [{id: 'restaurants-cat', name: 'Restaurants', parentId: null, viewType: 'grid', settings: {}}];
const providers = [{
  id: 'kampala-eats', businessName: 'Kampala Eats', description: 'Local dishes', categoryId: 'restaurants-cat',
  media: {}, ratingAvg: 4.5, ratingCount: 10,
}];
const listings = [{
  id: 'grilled-chicken', name: 'Grilled chicken platter', description: '', price: 20000,
  categoryId: 'restaurants-cat', productCategoryId: null, providerId: 'kampala-eats', media: {},
  provider: {businessName: 'Kampala Eats', categoryId: 'restaurants-cat', isApproved: true, moderationStatus: 'approved'},
}];

function stubPrisma(t) {
  const originals = {category: prisma.category.findMany, provider: prisma.provider.findMany, serviceProduct: prisma.serviceProduct.findMany};
  prisma.category.findMany = async () => categories;
  prisma.provider.findMany = async () => providers;
  prisma.serviceProduct.findMany = async () => listings;
  t.after(() => {
    prisma.category.findMany = originals.category;
    prisma.provider.findMany = originals.provider;
    prisma.serviceProduct.findMany = originals.serviceProduct;
  });
}

test('a query with no literal overlap finds nothing without AI expansion', async t => {
  stubPrisma(t);
  const service = new SearchService();
  const result = await service.search({q: 'I want to eat'});
  assert.deepEqual(result.categories, []);
  assert.deepEqual(result.providers, []);
  assert.deepEqual(result.listings, []);
});

test('AI-expanded terms and category ids surface the same query once the AI service is wired in', async t => {
  stubPrisma(t);
  const seen = [];
  const service = new SearchService({
    aiSearchService: {
      expand: async query => {
        seen.push(query);
        return {terms: ['restaurant', 'food', 'catering'], serviceCategoryIds: ['restaurants-cat'], listingServiceCategoryIds: [], productCategoryIds: [], intent: 'Restaurants & Food'};
      },
    },
  });
  const result = await service.search({q: 'I want to eat'});
  assert.deepEqual(seen, ['I want to eat']);
  assert.equal(result.categories.length, 1);
  assert.equal(result.categories[0].id, 'restaurants-cat');
  assert.equal(result.providers.length, 1);
  assert.equal(result.providers[0].id, 'kampala-eats');
  assert.equal(result.listings.length, 1);
  assert.equal(result.listings[0].id, 'grilled-chicken');
});

