import { test } from 'node:test';
import assert from 'node:assert/strict';
import { previewModel, renderGetApp } from '../src/sharing/sharePreview.js';

test('share previews use real uploads or the existing brand mark, never retired artwork', () => {
  for (const type of ['job', 'event', 'product', 'service']) {
    const community = type === 'job' || type === 'event';
    const item = { id: 'example', title: 'Example', name: 'Example', media: community ? [] : {} };
    assert.equal(previewModel(type, item).image, 'https://gogabla.com/brand/gabla-wordmark.png');
    item.media = community ? [{ type: 'image', url: 'https://example.test/upload.jpg' }] : { imageUrl: 'https://example.test/upload.jpg' };
    assert.equal(previewModel(type, item).image, 'https://example.test/upload.jpg');
  }
});

test('app download metadata does not reference a deleted generated image', () => {
  for (const available of [true, false]) {
    const html = renderGetApp({ available });
    assert(html.includes('property="og:image" content="https://gogabla.com/brand/gabla-wordmark.png"'));
    assert(!html.includes('/artwork/'));
  }
});
