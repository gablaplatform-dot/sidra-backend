// Replaces the earlier name-association migration. Dry-run unless --apply.
import 'dotenv/config';
import {PrismaClient} from '@prisma/client';
import {writeFileSync,chmodSync} from 'node:fs';
import {isAbsolute,resolve} from 'node:path';
import {syncServiceNode,syncShopNode} from '../src/domain/categoryMirrors.js';
import {suggestedServiceFields,appendMissingFields} from '../src/domain/serviceListingFields.js';
import {lineage} from '../src/domain/productTaxonomy.js';
const db=new PrismaClient(), apply=process.argv.includes('--apply');
const option=name=>{const i=process.argv.indexOf(name);return i<0?null:process.argv[i+1];};
const json=value=>JSON.stringify(value);
try {
 const categories=await db.category.findMany(),products=await db.productCategory.findMany(),legacy=await db.serviceCategory.findMany(),providers=await db.provider.findMany({select:{id:true,categoryId:true}}),listings=await db.serviceProduct.findMany();
 const byId=new Map(categories.map(c=>[c.id,c]));const productIds=new Set(products.map(c=>c.id));
 const electronics=categories.filter(c=>!c.parentId && c.name.trim().toLowerCase()==='electronics appliances' && !productIds.has(c.id));
 const electronicsRoot=products.find(c=>!c.parentId && c.name.trim().toLowerCase()==='electronics');
 if(electronics.length && !electronicsRoot) throw Error('Electronics shop root must exist before moving the old Electronics Appliances provider category.');
 const serviceNodes=categories.filter(c=>c.taxonomyKind==='service' && !electronics.some(e=>e.id===c.id));
 const additions=serviceNodes.map(c=>({id:c.id,name:c.name,fields:appendMissingFields(c.listingFields,suggestedServiceFields(lineage(categories,c.id).reverse().map(id=>byId.get(id)?.name).join(' / ')))}));
 // Preserve used legacy service IDs, fields and listing references under the actual owner branch.
 const bridges=[];
 for(const listing of listings.filter(l=>l.type==='service' && l.serviceCategoryId && !byId.has(l.serviceCategoryId))) {
  const provider=providers.find(p=>p.id===listing.providerId),old=legacy.find(c=>c.id===listing.serviceCategoryId);
  if(!provider?.categoryId || !old || !serviceNodes.some(c=>c.id===provider.categoryId)) throw Error('Used legacy service requires an explicit valid provider category.');
  const existing=bridges.find(b=>b.id===old.id);
  if(existing && existing.parentId!==provider.categoryId) throw Error('Legacy service is shared across different provider branches; explicit mapping required.');
  if(!existing) {
   const merged=new Map();for(const id of lineage(legacy,old.id).reverse())for(const f of legacy.find(c=>c.id===id)?.listingFields || [])merged.set(f.key,f);
   bridges.push({id:old.id,name:old.name,parentId:provider.categoryId,imageUrl:old.imageUrl,listingFields:appendMissingFields([...merged.values()],suggestedServiceFields(lineage(categories,provider.categoryId).reverse().map(id=>byId.get(id)?.name).join(" / ")+" / "+old.name)),isActive:old.isActive,sortOrder:old.sortOrder,moderationStatus:old.moderationStatus,settings:{bookable:old.bookable,bookingUnit:old.bookingUnit},taxonomyKind:'service'});
  }
 }
 const report={mode:apply?'apply':'dry-run',before:{providerCategories:categories.length,productCategories:products.length,legacyServiceCategories:legacy.length,listings:listings.length,providers:providers.length},serviceRoots:serviceNodes.filter(c=>!c.parentId).map(c=>({id:c.id,name:c.name})),shopRoots:products.filter(c=>!c.parentId).map(c=>({id:c.id,name:c.name})),serviceFieldAdditions:additions.map(c=>({id:c.id,name:c.name,added:c.fields.length-(byId.get(c.id).listingFields?.length || 0)})),legacyServiceBridges:bridges.map(b=>({id:b.id,name:b.name,parentId:b.parentId})),electronicsProviderMoves:providers.filter(p=>electronics.some(c=>c.id===p.categoryId)).map(p=>({providerId:p.id,from:p.categoryId,to:electronicsRoot.id})),existingMixedOrServiceSellers:providers.filter(p=>!electronics.some(c=>c.id===p.categoryId) && !productIds.has(p.categoryId) && listings.some(l=>l.providerId===p.id && l.type==='product')).map(p=>({providerId:p.id,categoryId:p.categoryId,action:'retain current category; existing listings remain editable; new products require a shop business category'}))};
 process.stdout.write(json(report)+'\n');if(option('--report'))writeFileSync(option('--report'),JSON.stringify(report,null,2));
 if(apply) {
  const url=process.env.DATABASE_URL;if(!url?.startsWith('file:'))throw Error('SQLite DATABASE_URL required');
  const raw=url.slice(5),source=isAbsolute(raw)?raw:resolve('prisma',raw),backup=`${source}.before-category-workspace-${Date.now()}.db`;
  await db.$executeRawUnsafe(`VACUUM INTO '${backup.replaceAll("'","''")}'`);chmodSync(backup,0o600);
  await db.$transaction(async(tx)=>{
   for(const c of serviceNodes) {
    const fields=additions.find(a=>a.id===c.id).fields;
    const node=await tx.category.update({where:{id:c.id},data:{listingFields:fields}});await syncServiceNode(tx,node);
   }
   for(const c of products)await syncShopNode(tx,c);
   for(const b of bridges){const node=await tx.category.create({data:b});await syncServiceNode(tx,node);}
   for(const p of report.electronicsProviderMoves)await tx.provider.update({where:{id:p.providerId},data:{categoryId:p.to}});
   for(const c of electronics)await tx.category.update({where:{id:c.id},data:{taxonomyKind:'shop',isActive:false}});
   // Every original listing and product node must remain byte-for-byte equivalent
   // except the new association and automatically maintained timestamps.
   for(const old of listings){const now=await tx.serviceProduct.findUnique({where:{id:old.id}});if(json(now)!==json(old))throw Error('Listing data changed unexpectedly');}
   for(const old of products){const now=await tx.productCategory.findUnique({where:{id:old.id}});const a={...old},b={...now};delete a.providerCategoryId;delete a.updatedAt;delete b.providerCategoryId;delete b.updatedAt;if(json(a)!==json(b))throw Error('Product category content changed unexpectedly');}
   for(const old of categories){const now=await tx.category.findUnique({where:{id:old.id}});if(!now || now.parentId!==old.parentId || now.name!==old.name || json(now.providerFields)!==json(old.providerFields) || json(now.settings)!==json(old.settings) || now.imageUrl!==old.imageUrl)throw Error('Existing provider category content changed unexpectedly');for(const f of old.listingFields || [])if(json(now.listingFields.find(x=>x.key===f.key))!==json(f))throw Error('Existing field changed unexpectedly');}
   if(await tx.serviceProduct.count()!==listings.length || await tx.productCategory.count()!==products.length || await tx.provider.count()!==providers.length)throw Error('Record count verification failed');
   if((await tx.$queryRawUnsafe('PRAGMA foreign_key_check')).length)throw Error('Foreign key verification failed');
  },{maxWait:10000,timeout:120000});
  process.stdout.write(json({applied:true,backup,counts:{providerCategories:await db.category.count(),productCategories:await db.productCategory.count(),serviceCategories:await db.serviceCategory.count(),listings:await db.serviceProduct.count()}})+'\n');
 }
} finally {await db.$disconnect();}
