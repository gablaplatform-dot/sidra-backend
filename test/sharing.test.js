import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import express from 'express';
import {PrismaClient} from '@prisma/client';
import {buildShareRoutes,previewModel,renderPreview} from '../src/sharing/sharePreview.js';
if(process.env.DATABASE_URL!=='file:/tmp/gabla-sharing-test.db')throw Error('Sharing tests require the isolated sharing fixture database');
const db=new PrismaClient();let server,base;const apk='/tmp/gabla-sharing-fixture.apk';
before(async()=>{
 assert.equal(await db.user.count(),0,'Fresh scratch database required');
 await db.user.create({data:{id:'publisher',role:'provider',name:'Fixture publisher',email:'PRIVATE_EMAIL@fixture.test'}});
 await db.provider.create({data:{id:'provider',userId:'publisher',businessName:'Garden Store',isApproved:true,moderationStatus:'approved',contact:{phone:'PRIVATE_LOCKED_PHONE'},district:'Kampala'}});
 for(const type of ['product','service'])await db.serviceProduct.create({data:{id:type,providerId:'provider',type,status:'approved',name:type==='product'?'Sound & light kit':'Live sound service',description:'A useful local listing with details for visitors.',price:25000,media:{imageUrl:`https://example.test/${type}.jpg`}}});
 for(const kind of ['job','event'])await db.communityPost.create({data:{id:kind,kind,ownerId:'publisher',status:'approved',title:kind==='job'?'Engineer & stage crew':'Garden evening',description:'A real description of the shared item for the preview page.',address:'The Garden, Kampala',organization:'Garden Sessions',category:'Creative',payMin:25000,media:[{type:'image',url:`https://example.test/${kind}.jpg`}],details:{requirements:'Bring technical experience.',phone:'PUBLIC_POSTER_PHONE'},...(kind==='event'?{startsAt:new Date('2027-01-01T15:00:00Z'),endsAt:new Date('2027-01-01T20:00:00Z')}:{} )}});
 await db.communityPost.create({data:{id:'private',kind:'job',ownerId:'publisher',status:'pending',title:'PRIVATE_PENDING_TITLE',description:'PRIVATE_PENDING_BODY',category:'Creative'}});
 fs.writeFileSync(apk,Buffer.from('APK_FIXTURE'));
 const app=express();app.use(buildShareRoutes({db,apkPath:apk}));app.use((e,_req,res,_next)=>res.status(500).json({message:e.message}));server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));base=`http://127.0.0.1:${server.address().port}`;
});
after(async()=>{await new Promise(r=>server.close(r));await db.$disconnect();fs.unlinkSync(apk);});
test('all four public types serve real Open Graph metadata and distinct HTML without JavaScript',async()=>{
 for(const type of ['job','event','product','service']){
  const r=await fetch(`${base}/share/${type}/${type}`,{headers:{'User-Agent':'WhatsApp/2.0'}});assert.equal(r.status,200);const html=await r.text();
  assert(html.includes(`property="og:image" content="https://example.test/${type}.jpg"`));
  assert(html.includes(`property="og:url" content="https://gogabla.com/share/${type}/${type}"`));
  assert(html.includes('summary_large_image'));assert(html.includes(`class="preview ${type}"`));assert(html.includes('Get the Gabla app'));assert(html.includes(`gabla:///share/${type}/${type}`));
  assert(!html.includes('<script'));assert(!html.includes('PRIVATE_EMAIL'));assert(!html.includes('PRIVATE_LOCKED_PHONE'));assert(!html.includes('PUBLIC_POSTER_PHONE'));
 }
});
test('pending, inactive-owner, declined-provider and wrong-type links do not leak content',async()=>{
 for(const path of ['/share/job/private','/share/job/product','/share/unknown/job']){const r=await fetch(base+path);assert.equal(r.status,404);assert(!(await r.text()).includes('PRIVATE_PENDING'));assert.equal(r.headers.get('cache-control'),'no-store');}
 await db.user.update({where:{id:'publisher'},data:{isActive:false}});assert.equal((await fetch(base+'/share/job/job')).status,404);assert.equal((await fetch(base+'/share/product/product')).status,404);await db.user.update({where:{id:'publisher'},data:{isActive:true}});
 await db.provider.update({where:{id:'provider'},data:{moderationStatus:'declined'}});assert.equal((await fetch(base+'/share/service/service')).status,404);await db.provider.update({where:{id:'provider'},data:{moderationStatus:'approved'}});
});
test('untrusted text and image URLs cannot become executable HTML',()=>{
 const model=previewModel('product',{id:'safe',name:'A "quoted" & useful item',description:'<img src=x onerror=alert(1)>Normal details',media:{imageUrl:'javascript:alert(1)'}});const html=renderPreview(model);
 assert(html.includes('A &quot;quoted&quot; &amp; useful item'));assert(!html.includes('javascript:'));assert(!html.includes('onerror='));assert(html.includes('https://gogabla.com/brand/gabla-wordmark.png'));
});
test('download landing has a working Android download with correct MIME and attachment header',async()=>{
 const page=await fetch(base+'/get-app');assert((await page.text()).includes('Download Android APK'));
 const r=await fetch(base+'/app/download');assert.equal(r.status,200);assert(r.headers.get('content-type').startsWith('application/vnd.android.package-archive'));assert(r.headers.get('content-disposition').includes('Gabla-Android.apk'));assert.equal(await r.text(),'APK_FIXTURE');
});
