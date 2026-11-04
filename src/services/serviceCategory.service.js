import { prisma } from '../config/db.js';
import { CategoryService } from './category.service.js';
import { ProductCategoryService } from './productCategory.service.js';
import { scopedProductTree, categoryWithin } from '../domain/productTaxonomy.js';
import { syncServiceNode } from '../domain/categoryMirrors.js';
import { AppError } from '../utils/AppError.js';
export const BOOKING_UNITS = ['night','day','hour'];
// Services use the provider service tree. Legacy ServiceCategory IDs remain valid
// for existing listings; new choices come solely from the canonical Category tree.
export class ServiceCategoryService extends ProductCategoryService {
  get supportsProviderCategories() { return false; }
  get db() { return prisma.serviceCategory; }
  async getNestedCategories({providerCategoryId}={}) {
    const data=await new CategoryService().getNestedCategories({taxonomyKind:'service'});
    const decorate=(nodes)=>nodes.map(n=>({...n,providerCategoryId:n.id,bookable:Boolean(n.settings?.bookable),bookingUnit:n.settings?.bookingUnit || null,children:decorate(n.children)}));
    let items=decorate(data.items);
    if(providerCategoryId) items=scopedProductTree(items,await prisma.category.findMany({select:{id:true,parentId:true}}),providerCategoryId);
    const count=(nodes)=>nodes.reduce((sum,n)=>sum+1+count(n.children),0);
    return {items,total:count(items)};
  }
  async listRoots({limit=6}={}) { const data=await this.getNestedCategories();return {items:data.items.slice(0,Math.min(60,Math.max(1,Number(limit)||6))),total:data.items.length}; }
  async createCategory(input) {return new CategoryService().createCategory({...input,settings:{bookable:input.bookable ?? false,bookingUnit:input.bookingUnit || null}});}
  async createSubcategory(input) {return new CategoryService().createSubcategory({...input,settings:{bookable:input.bookable ?? false,bookingUnit:input.bookingUnit || null}});}
  async updateCategory(input) {
    const node=await prisma.category.findUnique({where:{id:input.id}});
    if(!node || node.taxonomyKind!=='service') throw new AppError({message:'Service category not found',statusCode:404,code:'CATEGORY_NOT_FOUND'});
    const settings={...node.settings};
    if(input.bookable!==undefined) settings.bookable=input.bookable;
    if(input.bookingUnit!==undefined) settings.bookingUnit=input.bookingUnit || null;
    return new CategoryService().updateCategory({...input,settings});
  }
  async deleteCategory(input) {return new CategoryService().deleteCategory(input);}
  async reorderCategories(input) {return new CategoryService().reorderCategories(input);}
  async createFromProvider({actorUserId,name,parentId,imageUrl}) {
    const provider=await this.getProviderForUser(actorUserId);
    const directory=await prisma.category.findMany();const parent=directory.find(c=>c.id===parentId);
    if(!parent || parent.taxonomyKind!=='service' || !parent.isActive || !categoryWithin(directory,parentId,provider.categoryId)) throw new AppError({message:'Choose a service subcategory within your business category',statusCode:400,code:'SERVICE_CATEGORY_OUTSIDE_BUSINESS'});
    return prisma.$transaction(async(tx)=>{
      const max=await tx.category.aggregate({where:{parentId},_max:{sortOrder:true}});
      const node=await tx.category.create({data:{name,parentId,taxonomyKind:'service',imageUrl:imageUrl || parent.imageUrl,isActive:true,moderationStatus:'pending',createdByProviderId:provider.id,sortOrder:(max._max.sortOrder ?? -1)+1,behavior:parent.behavior,viewType:parent.viewType,appView:parent.appView}});
      await syncServiceNode(tx,node);return new CategoryService().toDto(node);
    });
  }
}
