import { prisma } from '../config/db.js';
import { AppError } from '../utils/AppError.js';
const fail = (message, code='NOT_FOUND', statusCode=404) => {throw new AppError({message,code,statusCode});};
const publicOwner = {id:true,name:true,avatarUrl:true,isActive:true};
const terminal = new Set(['closed','cancelled']);
export class CommunityService {
  constructor(db=prisma) {this.db=db;}
  async owned(kind,id,userId) {
    const post=await this.db.communityPost.findFirst({where:{id,kind,ownerId:userId}});
    if(!post)fail('Post not found');
    return post;
  }
  normalize(kind,input,existing={}) {
    const data={...existing,...input};
    if(data.payMax && Number(data.payMax)<Number(data.payMin))fail('Maximum pay must be at least minimum pay','INVALID_PAY',400);
    if(kind==='event' && (!data.startsAt || !data.endsAt || new Date(data.endsAt)<=new Date(data.startsAt)))fail('Choose an end time after the start','INVALID_EVENT_DATES',400);
    const result={};
    for(const k of ['title','description','organization','category','district','address','lat','lng','jobType','employmentType','workplace','payMin','payMax','currency','media','details']) if(data[k]!==undefined)result[k]=data[k];
    for(const k of ['startsAt','endsAt','deadline']) if(data[k]!==undefined)result[k]=data[k]?new Date(data[k]):null;
    if(kind==='event') {result.jobType=null;result.employmentType=null;result.workplace=null;result.deadline=null;}
    else {result.startsAt=null;result.endsAt=null;}
    return result;
  }
  dto(post,{includeModeration=false}={}) {
    return {...post,moderationNote:includeModeration?post.moderationNote:undefined,payMin:Number(post.payMin),payMax:Number(post.payMax),owner:post.owner && {id:post.owner.id,name:post.owner.name,avatarUrl:post.owner.avatarUrl},applicationCount:post._count?.applications ?? 0,responseCount:post._count?.responses ?? 0,_count:undefined};
  }
  async create(kind,userId,input) {
    const data=this.normalize(kind,input);
    return this.dto(await this.db.communityPost.create({data:{...data,kind,ownerId:userId,status:'pending'},include:{owner:{select:publicOwner}}}));
  }
  async edit(kind,id,userId,input) {
    const post=await this.owned(kind,id,userId);
    return this.dto(await this.db.communityPost.update({where:{id},data:{...this.normalize(kind,input,post),status:'pending',moderationNote:''},include:{owner:{select:publicOwner}}}));
  }
  async list(kind,query={},userId=null,{mine=false,admin=false,saved=false}={}) {
    const page=Math.max(1,Number(query.page)||1),limit=Math.min(40,Math.max(1,Number(query.limit)||20));
    const where={kind};
    if(mine)where.ownerId=userId;
    else if(!admin){where.status='approved';where.owner={isActive:true};}
    if(admin && query.status)where.status=query.status;
    if(saved)where.responses={some:{userId}};
    if(query.q)where.OR=['title','description','organization'].map((key)=>({[key]:{contains:query.q}}));
    for(const key of ['category','district','jobType','workplace','employmentType'])if(query[key])where[key]=query[key];
    if(query.minPay!==undefined)where.payMax={gte:Number(query.minPay)};
    if(kind==='event' && !mine && !admin) {
      where.endsAt={gte:new Date()};
      if(query.from || query.to)where.startsAt={...(query.from?{gte:new Date(query.from)}:{}),...(query.to?{lte:new Date(query.to)}:{})};
    }
    if(kind==='job' && !mine && !admin)where.AND=[{OR:[{deadline:null},{deadline:{gte:new Date()}}]}];
    const [items,total]=await Promise.all([this.db.communityPost.findMany({where,include:{owner:{select:publicOwner},_count:{select:{applications:true,responses:true}}},orderBy:kind==='event' && !mine ? [{startsAt:'asc'},{createdAt:'desc'}]:{createdAt:'desc'},skip:(page-1)*limit,take:limit}),this.db.communityPost.count({where})]);
    return {items:items.map((p)=>this.dto(p,{includeModeration:mine||admin})),total,page,limit};
  }
  async detail(kind,id,viewer) {
    const post=await this.db.communityPost.findFirst({where:{id,kind},include:{owner:{select:publicOwner},_count:{select:{responses:true,applications:true}}}});
    if(!post || (post.owner?.isActive===false && viewer?.id!==post.ownerId && viewer?.role!=='admin') || (post.status!=='approved' && post.ownerId!==viewer?.id && viewer?.role!=='admin'))fail('Post not found');
    const [response,application]=viewer ? await Promise.all([this.db.communityResponse.findUnique({where:{postId_userId:{postId:id,userId:viewer.id}}}),this.db.communityApplication.findUnique({where:{postId_userId:{postId:id,userId:viewer.id}}})]):[null,null];
    return {...this.dto(post,{includeModeration:viewer?.id===post.ownerId||viewer?.role==='admin'}),myResponse:response?.status||null,myApplication:application,canManage:viewer?.id===post.ownerId};
  }
  async close(kind,id,userId) {
    await this.owned(kind,id,userId);
    return this.db.communityPost.update({where:{id},data:{status:kind==='event'?'cancelled':'closed'}});
  }
  async respond(kind,id,userId,status) {
    const post=await this.detail(kind,id,{id:userId});
    if(post.status!=='approved')fail('This post is not published','NOT_PUBLISHED',409);
    if(status===null) {await this.db.communityResponse.deleteMany({where:{postId:id,userId}});return {status:null};}
    if(kind==='job' && status!=='saved')fail('Choose saved for a job','INVALID_RESPONSE',400);
    if(kind==='event' && new Date(post.endsAt)<=new Date())fail('This event has ended','EVENT_ENDED',409);
    await this.db.communityResponse.upsert({where:{postId_userId:{postId:id,userId}},create:{postId:id,userId,status},update:{status}});
    return {status};
  }
  async apply(id,userId,input) {
    const post=await this.detail('job',id,{id:userId});
    if(post.ownerId===userId)fail('You cannot apply to your own post','OWN_JOB',400);
    if(post.status!=='approved' || post.jobType==='seeking_work' || (post.deadline && new Date(post.deadline)<new Date()))fail('This job is not accepting applications','JOB_CLOSED',409);
    const existing=await this.db.communityApplication.findUnique({where:{postId_userId:{postId:id,userId}}});
    if(existing && existing.status!=='withdrawn')fail('You have already applied','ALREADY_APPLIED',409);
    return this.db.communityApplication.upsert({where:{postId_userId:{postId:id,userId}},create:{...input,postId:id,userId,status:'submitted'},update:{...input,status:'submitted'}});
  }
  async applications(userId) {
    return {items:await this.db.communityApplication.findMany({where:{userId},include:{post:{select:{id:true,title:true,organization:true,status:true}}},orderBy:{createdAt:'desc'}})};
  }
  async applicants(id,userId) {
    await this.owned('job',id,userId);
    return {items:await this.db.communityApplication.findMany({where:{postId:id},include:{user:{select:{...publicOwner,email:true}}},orderBy:{createdAt:'desc'}})};
  }
  async updateApplication(id,userId,status) {
    const application=await this.db.communityApplication.findUnique({where:{id},include:{post:{select:{ownerId:true}}}});
    if(!application)fail('Application not found');
    if(status==='withdrawn' ? application.userId!==userId : application.post.ownerId!==userId)fail('Application not found');
    if(application.status==='withdrawn' && status!=='withdrawn')fail('This application was withdrawn','WITHDRAWN',409);
    return this.db.communityApplication.update({where:{id},data:{status}});
  }
  async moderate(kind,id,status,note) {
    const post=await this.db.communityPost.findFirst({where:{id,kind}});
    if(!post)fail('Post not found');
    if(terminal.has(post.status) && status==='approved')fail('The owner has closed this post','POST_CLOSED',409);
    return this.db.communityPost.update({where:{id},data:{status,moderationNote:note||''}});
  }
}
