import {test} from 'node:test';import assert from 'node:assert/strict';
import {onRequestGet} from '../public_app/functions/share/[type]/[id].js';
test('Pages preview proxy uses a fixed backend and preserves server HTML, status and metadata headers',async()=>{
 const original=globalThis.fetch;let target;
 globalThis.fetch=async(url,options)=>{target=url;assert(!options.headers.Authorization);return new Response('<meta property="og:image" content="https://example.test/poster.jpg">',{headers:{'Content-Type':'text/html','Cache-Control':'public, max-age=60'}});};
 try{const response=await onRequestGet({params:{type:'event',id:'fixture'}});assert.equal(target,'https://sidra-api.fly.dev/share/event/fixture');assert.equal(response.status,200);assert((await response.text()).includes('og:image'));assert.equal(response.headers.get('Content-Type'),'text/html');assert.equal((await onRequestGet({params:{type:'http:',id:'external'}})).status,404);assert.equal((await onRequestGet({params:{type:'job',id:'../secret'}})).status,404);}finally{globalThis.fetch=original;}
});
