// Category is the provider taxonomy. Product/ServiceCategory retain listing FK IDs.
// Mirrors are written in the same transaction as their source, never by name matching.
export async function syncServiceNode(tx, node) {
  if (node.taxonomyKind !== 'service') return;
  if (node.parentId) {
    const parent = await tx.category.findUnique({where:{id:node.parentId}});
    if (parent) await syncServiceNode(tx,parent);
  }
  const data={name:node.name,parentId:node.parentId,imageUrl:node.imageUrl || node.settings?.imageUrl || null,listingFields:node.listingFields,isActive:node.isActive,sortOrder:node.sortOrder,moderationStatus:node.moderationStatus,createdByProviderId:node.createdByProviderId,bookable:Boolean(node.settings?.bookable),bookingUnit:node.settings?.bookingUnit || null};
  await tx.serviceCategory.upsert({where:{id:node.id},create:{id:node.id,...data},update:data});
}
export async function syncShopNode(tx,node) {
  const data={name:node.name,parentId:node.parentId,taxonomyKind:'shop',behavior:'online_shop',viewType:'ecommerce',appView:'ecommerce',imageUrl:node.imageUrl,listingFields:node.listingFields,isActive:node.isActive,sortOrder:node.sortOrder,moderationStatus:node.moderationStatus};
  if(node.parentId && !await tx.category.findUnique({where:{id:node.parentId}})) {
    const parent=await tx.productCategory.findUnique({where:{id:node.parentId}});
    if(parent) await syncShopNode(tx,parent);
  }
  const existing=await tx.category.findUnique({where:{id:node.id}});
  if(existing && existing.taxonomyKind!=='shop') throw new Error('Taxonomy ID collision');
  await tx.category.upsert({where:{id:node.id},create:{id:node.id,...data},update:data});
  return tx.productCategory.update({where:{id:node.id},data:{providerCategoryId:node.id}});
}
