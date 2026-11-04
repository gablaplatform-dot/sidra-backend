import {test} from 'node:test';import assert from 'node:assert/strict';
import {onRequestGet} from '../public_app/functions/share/[type]/[id].js';
test('Pages preview proxy uses a fixed backend and preserves server HTML, status and metadata headers',async()=>{
 const original=globalThis.fetch;let target;
 globalThis.fetch=async(url,options)=>{target=url;assert(!options.headers.Authorization);assert.equal(options.redirect,'manual');return new Response('<meta property="og:image" content="https://example.test/poster.jpg">',{headers:{'Content-Type':'text/html','Cache-Control':'public, max-age=60'}});};
 try{const response=await onRequestGet({params:{type:'event',id:'fixture'}});assert.equal(target,'https://sidra-api.fly.dev/share/event/fixture');assert.equal(response.status,200);assert((await response.text()).includes('og:image'));assert.equal(response.headers.get('Content-Type'),'text/html');assert.equal((await onRequestGet({params:{type:'http:',id:'external'}})).status,404);assert.equal((await onRequestGet({params:{type:'job',id:'../secret'}})).status,404);}finally{globalThis.fetch=original;}
});

test('Pages does not follow or relay an unexpected upstream redirect',async()=>{const original=globalThis.fetch;globalThis.fetch=async()=>new Response(null,{status:302,headers:{Location:'https://unrelated.test'}});try{const response=await onRequestGet({params:{type:'job',id:'fixture'}});assert.equal(response.status,503);assert.equal(response.headers.get('Location'),null);}finally{globalThis.fetch=original;}});
