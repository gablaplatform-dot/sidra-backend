import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {PrismaClient} from '@prisma/client';
import {buildCommunityRoutes} from '../src/routes/community.routes.js';
import {CommunityService} from '../src/services/community.service.js';
import {scopedProductTree} from '../src/domain/productTaxonomy.js';
import {signAccessToken} from '../src/utils/jwt.js';
import {env} from '../src/config/env.js';
if(process.env.DATABASE_URL !== 'file:/tmp/gabla-community-test.db') throw new Error('Community tests only run against file:/tmp/gabla-community-test.db. Production reset is refused.');
const db=new PrismaClient();
const service=new CommunityService(db);
let server,base;
const tokens={};
before(async()=>{
  await db.communityApplication.deleteMany();await db.communityResponse.deleteMany();await db.communityPost.deleteMany();
  const role=await db.adminRole.upsert({where:{key:'community_test'},create:{key:'community_test',name:'Community test',permissions:['jobs','events']},update:{permissions:['jobs','events']}});
  for(const id of ['poster','applicant','outsider','reviewer']){
    await db.user.upsert({where:{id},create:{id,name:id,email:`${id}@fixture.test`,role:id==='reviewer'?'admin':'user',adminRoleId:id==='reviewer'?role.id:null},update:{isActive:true}});
    tokens[id]=signAccessToken({payload:{sub:id,role:id==='reviewer'?'admin':'user'},secret:env.jwtSecret,issuer:env.jwtIssuer,ttlSeconds:3600});
  }
  const app=express();app.use(express.json());app.use('/jobs',buildCommunityRoutes('job',{service}));app.use('/events',buildCommunityRoutes('event',{service}));
  app.use((e,_req,res,_next)=>res.status(e.statusCode||500).json({error:{code:e.code,message:e.message}}));
  server=app.listen(0,'127.0.0.1');await new Promise((r)=>server.once('listening',r));base=`http://127.0.0.1:${server.address().port}`;
});
after(async()=>{await new Promise((r)=>server.close(r));await db.$disconnect();});
async function call(path,{user,method='GET',body}={}){const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(user?{Authorization:`Bearer ${tokens[user]}`}:{})},body:body?JSON.stringify(body):undefined});return {status:response.status,...await response.json()};}
const job={address:'Kampala, Uganda',title:'Sound engineer for live shows',description:'Help set up sound and run a live stage for community concerts.',organization:'Fixture Stage',category:'Creative',jobType:'task',payMin:150000,payMax:200000,details:{payPeriod:'task'},media:[]};
test('job posting, moderation, private application workflow and owner isolation',async()=>{
 assert.equal((await call('/jobs',{method:'POST',body:job})).status,401);
 const injected=await call('/jobs',{user:'poster',method:'POST',body:{...job,ownerId:'outsider'}});
 assert.equal(injected.data.ownerId,'poster');
 const withoutLocation={...job};delete withoutLocation.address;assert.equal((await call('/jobs',{user:'poster',method:'POST',body:withoutLocation})).status,400);
 const created=await call('/jobs',{user:'poster',method:'POST',body:job});assert.equal(created.status,200);assert.equal(created.data.status,'pending');const id=created.data.id;
 assert.equal((await call('/jobs')).data.total,0);
 assert.equal((await call(`/jobs/${id}`)).status,404);
 assert.equal((await call(`/jobs/${id}`,{user:'outsider',method:'PATCH',body:{title:'Stolen'}})).status,404);
 assert.equal((await call(`/jobs/admin/${id}`,{user:'poster',method:'PATCH',body:{status:'approved'}})).status,403);
 assert.equal((await call(`/jobs/admin/${id}`,{user:'reviewer',method:'PATCH',body:{status:'approved',note:'Internal review fixture'}})).status,200);
 assert.equal((await call('/jobs?jobType=task')).data.total,1);
 assert.equal((await call(`/jobs/${id}`)).data.moderationNote,undefined);
 const apply={coverLetter:'I have several years of live sound and stage experience.',phone:'0700000000',portfolioUrl:'https://example.test/portfolio'};
 const application=await call(`/jobs/${id}/apply`,{user:'applicant',method:'POST',body:apply});assert.equal(application.status,200);
 assert.equal((await call(`/jobs/${id}/apply`,{user:'applicant',method:'POST',body:apply})).status,409);
 assert.equal((await call(`/jobs/${id}/applicants`,{user:'outsider'})).status,404);
 assert.equal((await call(`/jobs/${id}/applicants`,{user:'poster'})).data.items[0].user.email,'applicant@fixture.test');
 assert.equal((await call(`/jobs/applications/${application.data.id}`,{user:'outsider',method:'PATCH',body:{status:'shortlisted'}})).status,404);
 assert.equal((await call(`/jobs/applications/${application.data.id}`,{user:'poster',method:'PATCH',body:{status:'shortlisted'}})).data.status,'shortlisted');
 assert.equal((await call('/jobs/applications/mine',{user:'applicant'})).data.items[0].status,'shortlisted');
 assert.equal((await call(`/jobs/applications/${application.data.id}`,{user:'applicant',method:'PATCH',body:{status:'withdrawn'}})).status,200);
 assert.equal((await call(`/jobs/${id}/close`,{user:'poster',method:'POST'})).status,200);
 assert.equal((await call(`/jobs/${id}/apply`,{user:'outsider',method:'POST',body:apply})).status,404);
});
test('event validation, RSVP, saved list and cancellation without ticket sales',async()=>{
 const start=new Date(Date.now()+86400000),end=new Date(start.getTime()+7200000);
 const event={address:'The Garden, Kampala',title:'Live band at the garden',description:'An evening of live music, friends and local food in the garden.',organization:'Garden Sessions',category:'Music',payMin:25000,payMax:25000,startsAt:start.toISOString(),endsAt:end.toISOString(),media:[{url:'https://example.test/poster.png',type:'image'},{url:'https://example.test/trailer.mp4',type:'video'}],details:{entranceNote:'Pay at the door'}};
 assert.equal((await call('/events',{user:'poster',method:'POST',body:{...event,endsAt:start.toISOString()}})).status,400);
 const post=(await call('/events',{user:'poster',method:'POST',body:event})).data;
 await call(`/events/admin/${post.id}`,{user:'reviewer',method:'PATCH',body:{status:'approved'}});
 assert.equal((await call(`/events/${post.id}/response`,{user:'applicant',method:'PUT',body:{status:'going'}})).data.status,'going');
 assert.equal((await call('/events/saved',{user:'applicant'})).data.total,1);
 assert.equal((await call(`/events/${post.id}`)).data.myResponse,null);
 assert.equal((await call(`/events/${post.id}`,{user:'applicant'})).data.myResponse,'going');
 await call(`/events/${post.id}/close`,{user:'poster',method:'POST'});
 assert.equal((await call('/events')).data.total,0);
 assert.equal((await call(`/events/${post.id}/response`,{user:'applicant',method:'PUT',body:{status:'going'}})).status,404);
});
test('provider choices include descendants and breadcrumbs, excluding sibling branches',()=>{
 const directory=[{id:'electronics',parentId:null},{id:'phones',parentId:'electronics'},{id:'laptops',parentId:'electronics'},{id:'cars',parentId:null}];
 const products=[{id:'electronics',providerCategoryId:'electronics',children:[{id:'phones',providerCategoryId:'phones',children:[]},{id:'laptops',providerCategoryId:'laptops',children:[]}]},{id:'cars',providerCategoryId:'cars',children:[]}];
 const own=scopedProductTree(products,directory,'phones');assert.deepEqual(own.map(p=>p.id),['electronics']);assert.deepEqual(own[0].children.map(p=>p.id),['phones']);
 assert.equal(own[0].children[0].effectiveProviderCategoryId,'phones');
 assert.deepEqual(scopedProductTree(products,directory,'cars').map(p=>p.id),['cars']);
 assert.deepEqual(scopedProductTree(products,directory,'unassigned'),[]);
});
