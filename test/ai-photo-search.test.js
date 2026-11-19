import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {AiSearchService} from '../src/services/ai/aiSearch.service.js';
import {SearchController} from '../src/controllers/search.controller.js';
import {buildSearchRoutes} from '../src/routes/search.routes.js';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j05sAAAAASUVORK5CYII=', 'base64');
function setup(enabled = true) {
  const events = [];
  const settings = {
    runtime: async () => ({enabled, apiKey: 'test-key', model: 'test-vision-model'}),
    recordSuccess: () => events.push('success'),
    recordFailure: error => events.push(error)
  };
  const service = new AiSearchService({aiSettingsService: settings});
  const rows = [
    {code: 'P1', id: 'laptops', name: 'Laptops & Computers'},
    {code: 'P2', id: 'phones', name: 'Mobile Phones'},
    {code: 'P3', id: 'shoes', name: "Men's Shoes"},
  ];
  service._catalog = async () => ({rows, byCode: new Map(rows.map(row => [row.code, row.id])), text: 'P1 Laptops & Computers\nP2 Mobile Phones\nP3 Shoes'});
  return {service, events};
}

test('photo recognition sends the actual image and sanitizes its search phrase', async t => {
  const {service, events} = setup();
  let sent;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    sent = JSON.parse(options.body);
    return {ok: true, json: async () => ({content: [{type: 'text', text: '{"query":"WHITE Nike sneakers!!!", "intent":"Running Shoes"}'}]})};
  });
  assert.deepEqual(await service.describeImage({buffer: png, contentType: 'image/png'}), {query: 'white nike sneakers', intent: 'Running Shoes'});
  assert.equal(sent.messages[0].content[0].source.data, png.toString('base64'));
  assert.equal(sent.messages[0].content[0].source.media_type, 'image/png');
  assert.deepEqual(events, ['success']);
});

test('empty detections remain empty instead of inventing a product', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ok: true, json: async () => ({content: [{type: 'text', text: '{"query":"","intent":""}'}]})}));
  assert.deepEqual(await setup().service.describeImage({buffer: png, contentType: 'image/png'}), {query: '', intent: ''});
});

test('malformed AI replies produce a retryable error and are not counted as success', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ok: true, json: async () => ({content: [{type: 'text', text: '{"query":{"invented":"object"}}'}]})}));
  const {service, events} = setup();
  await assert.rejects(service.describeImage({buffer: png, contentType: 'image/png'}), {code: 'PHOTO_SEARCH_FAILED', statusCode: 502});
  assert.equal(events.length, 1);
  assert.notEqual(events[0], 'success');
});

test('disabled AI, invalid images and oversize uploads do not make an AI request', async t => {
  const network = t.mock.method(globalThis, 'fetch', () => {throw new Error('must not call AI');});
  await assert.rejects(setup(false).service.describeImage({buffer: png, contentType: 'image/png'}), {code: 'PHOTO_SEARCH_UNAVAILABLE'});
  for (const [buffer, contentType] of [[Buffer.from('not an image'), 'image/png'], [png, 'image/jpeg'], [png, 'application/json'], [Buffer.alloc(0), 'image/png']]) {
    await assert.rejects(setup().service.describeImage({buffer, contentType}), {code: 'INVALID_IMAGE'});
  }
  const large = Buffer.concat([png, Buffer.alloc(5 * 1024 * 1024)]);
  await assert.rejects(setup().service.describeImage({buffer: large, contentType: 'image/png'}), {code: 'IMAGE_TOO_LARGE'});
  assert.equal(network.mock.callCount(), 0);
});

test('catalog scopes remain correct when shop/provider and product IDs overlap', () => {
  const {service} = setup();
  const catalog = {byCode: new Map([['S1', 'shared-shop-id'], ['P1', 'shared-shop-id'], ['V1', 'repair-id']]), serviceIds: new Set(['shared-shop-id']), listingServiceIds: new Set(['repair-id'])};
  const result = service._parse('{"terms":["sneakers"],"categories":["P1","V1","missing"],"intent":"Shoes"}', catalog);
  assert.deepEqual(result.productCategoryIds, ['shared-shop-id']);
  assert.deepEqual(result.serviceCategoryIds, []);
  assert.deepEqual(result.listingServiceCategoryIds, ['repair-id']);
});

test('HTTP photo endpoint accepts raw bytes without signing in and applies its rate limit', async t => {
  let calls = 0;
  const controller = new SearchController({searchService: {}, aiSearchService: {describeImage: async ({buffer, contentType}) => {
    assert.ok(Buffer.isBuffer(buffer)); assert.ok(buffer.equals(png)); assert.equal(contentType, 'image/png');
    calls++;
    return {query: 'sneakers', intent: 'Shoes'};
  }}});
  const app = express();
  app.use(express.json());
  app.use('/search', buildSearchRoutes({searchController: controller}));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/search/image`;
  for (let n = 0; n < 30; n++) {
    const response = await fetch(url, {method: 'POST', headers: {'content-type': 'image/png'}, body: png});
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {data: {query: 'sneakers', intent: 'Shoes'}});
  }
  const limited = await fetch(url, {method: 'POST', headers: {'content-type': 'image/png'}, body: png});
  assert.equal(limited.status, 429);
  assert.equal((await limited.json()).error.code, 'RATE_LIMITED');
  assert.equal(calls, 30);
});
