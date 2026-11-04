// Run after db:push/db:generate. Dry-run is the default; --apply backs up SQLite first.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { readFileSync, writeFileSync, mkdirSync, chmodSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { buildTaxonomyPlan } from '../src/domain/taxonomyMigration.js';
const db = new PrismaClient();
const apply = process.argv.includes('--apply');
const option = (name) => { const i=process.argv.indexOf(name); return i<0 ? null : process.argv[i+1]; };
try {
  const categories = await db.category.findMany();
  const products = await db.productCategory.findMany();
  const listings = await db.serviceProduct.findMany({where:{type:'product'},select:{productCategoryId:true,provider:{select:{categoryId:true}}}});
  const usage = listings.map((l)=>({productCategoryId:l.productCategoryId,providerCategoryId:l.provider.categoryId}));
  const mapping = option('--mapping') ? JSON.parse(readFileSync(option('--mapping'),'utf8')) : {};
  const plan = buildTaxonomyPlan({categories,products,usage,mapping});
  const report = {mode:apply?'apply':'dry-run',productCount:products.length,listingCount:listings.length,plan};
  process.stdout.write(JSON.stringify(report,null,2)+'\n');
  if (option('--report')) writeFileSync(option('--report'),JSON.stringify(report,null,2));
  if (apply) {
    if (plan.some((p)=>p.action==='review')) throw new Error('Resolve review entries using --mapping before applying. No data changed.');
    const url = process.env.DATABASE_URL || 'file:./dev.db';
    if (!url.startsWith('file:')) throw new Error('This migration requires the SQLite database.');
    const raw=url.slice(5), source=isAbsolute(raw)?raw:resolve('prisma',raw);
    const backup = `${source}.before-taxonomy-${Date.now()}.db`;
    mkdirSync(dirname(backup),{recursive:true});
    await db.$executeRawUnsafe(`VACUUM INTO '${backup.replaceAll("'","''")}'`);
    chmodSync(backup,0o600);
    await db.$transaction(async(tx)=>{
      let shop=await tx.category.findFirst({where:{parentId:null,name:'Shop'}});
      for (const item of plan) {
        if (item.action==='linked') continue;
        let owner=item.providerCategoryId;
        if (item.action==='create-business-category') {
          shop ||= await tx.category.create({data:{name:'Shop',behavior:'online_shop',viewType:'ecommerce',appView:'ecommerce'}});
          const existing=await tx.category.findFirst({where:{parentId:shop.id,name:item.name}});
          const branch=existing || await tx.category.create({data:{name:item.name,parentId:shop.id,behavior:'online_shop',viewType:'ecommerce',appView:'ecommerce',isActive:products.find((p)=>p.id===item.productCategoryId)?.isActive ?? true,sortOrder:products.find((p)=>p.id===item.productCategoryId)?.sortOrder ?? 0,imageUrl:products.find((p)=>p.id===item.productCategoryId)?.imageUrl}});
          owner=branch.id;
        }
        await tx.productCategory.update({where:{id:item.productCategoryId},data:{providerCategoryId:owner}});
      }
      if (await tx.productCategory.count()!==products.length || await tx.serviceProduct.count({where:{type:'product'}})!==listings.length) throw new Error('Record-count verification failed');
      const violations=await tx.$queryRawUnsafe('PRAGMA foreign_key_check');
      if(violations.length) throw new Error('Foreign-key verification failed');
    });
    process.stdout.write(`Applied without changing product/listing IDs. SQLite backup: ${backup}\n`);
  }
} finally { await db.$disconnect(); }
