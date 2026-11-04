import {Router} from 'express';
import Joi from 'joi';
import {requireAuth,optionalAuth,requirePermission} from '../middlewares/auth.middleware.js';
import {validate} from '../middlewares/validate.middleware.js';
import {CommunityService} from '../services/community.service.js';
const text=(max=200)=>Joi.string().trim().max(max);
const url=Joi.string().uri({scheme:['https']}).max(2000);
const details=Joi.object({phone:text(40).allow(''),email:Joi.string().email().allow(''),website:url.allow(''),requirements:text(10000).allow(''),skills:Joi.array().items(text(80)).max(30),payPeriod:Joi.string().valid('hour','day','week','month','year','task','negotiable'),entranceNote:text(500).allow(''),ageRestriction:text(100).allow(''),bookingUrl:url.allow('')});
const shared={title:text(180),description:text(20000),organization:text(160).allow(''),category:text(100),district:text(100).allow(''),address:text(500).min(2),lat:Joi.number().min(-90).max(90).allow(null),lng:Joi.number().min(-180).max(180).allow(null),payMin:Joi.number().min(0).max(1e12),payMax:Joi.number().min(0).max(1e12),currency:Joi.string().valid('UGX','USD','KES','TZS'),media:Joi.array().items(Joi.object({url:url.required(),type:Joi.string().valid('image','video').required()})).max(15),details};
const job={...shared,jobType:Joi.string().valid('vacancy','task','seeking_work'),employmentType:Joi.string().valid('full_time','part_time','contract','temporary','internship'),workplace:Joi.string().valid('onsite','hybrid','remote'),deadline:Joi.date().iso().allow(null)};
const event={...shared,startsAt:Joi.date().iso(),endsAt:Joi.date().iso()};
export function buildCommunityRoutes(kind,{service=new CommunityService()}={}) {
  const router=Router(),permission=kind==='job'?'jobs':'events';
  const handle=(fn)=>(req,res,next)=>Promise.resolve(fn(req)).then((data)=>res.json({data})).catch(next);
  const signed=requireAuth();
  const schema=kind==='job'?job:event;
  const query=Joi.object({q:text(200),category:text(100),district:text(100),jobType:job.jobType,employmentType:job.employmentType,workplace:job.workplace,minPay:Joi.number().min(0),from:Joi.date().iso(),to:Joi.date().iso(),page:Joi.number().integer().min(1),limit:Joi.number().integer().min(1).max(40),status:Joi.string().valid('pending','approved','declined','suspended','closed','cancelled')});
  router.get('/',validate(query,'query'),handle((r)=>service.list(kind,r.query)));
  router.get('/mine',signed,validate(query,'query'),handle((r)=>service.list(kind,r.query,r.user.id,{mine:true})));
  router.get('/saved',signed,validate(query,'query'),handle((r)=>service.list(kind,r.query,r.user.id,{saved:true})));
  if(kind==='job') {
    router.get('/applications/mine',signed,handle((r)=>service.applications(r.user.id)));
    router.patch('/applications/:id',signed,validate(Joi.object({status:Joi.string().valid('reviewed','shortlisted','declined','withdrawn').required()})),handle((r)=>service.updateApplication(r.params.id,r.user.id,r.body.status)));
    router.get('/:id/applicants',signed,handle((r)=>service.applicants(r.params.id,r.user.id)));
    router.post('/:id/apply',signed,validate(Joi.object({coverLetter:text(10000).min(20).required(),phone:text(40).allow(''),portfolioUrl:url.allow('')})),handle((r)=>service.apply(r.params.id,r.user.id,r.body)));
  }
  router.get('/admin',requireAuth(['admin']),requirePermission(permission),validate(query,'query'),handle((r)=>service.list(kind,r.query,r.user.id,{admin:true})));
  router.patch('/admin/:id',requireAuth(['admin']),requirePermission(permission),validate(Joi.object({status:Joi.string().valid('approved','declined','suspended').required(),note:text(2000).allow('')})),handle((r)=>service.moderate(kind,r.params.id,r.body.status,r.body.note)));
  router.get('/:id',optionalAuth(),handle((r)=>service.detail(kind,r.params.id,r.user)));
  router.post('/',signed,validate(Joi.object({...schema,address:shared.address.required(),title:schema.title.required(),description:schema.description.min(20).required(),category:schema.category.required(),...(kind==='event'?{startsAt:event.startsAt.required(),endsAt:event.endsAt.required()}:{jobType:job.jobType.default('vacancy'),employmentType:job.employmentType.default('full_time'),workplace:job.workplace.default('onsite')})})),handle((r)=>service.create(kind,r.user.id,r.body)));
  router.patch('/:id',signed,validate(Joi.object(schema).min(1)),handle((r)=>service.edit(kind,r.params.id,r.user.id,r.body)));
  router.post('/:id/close',signed,handle((r)=>service.close(kind,r.params.id,r.user.id)));
  router.put('/:id/response',signed,validate(Joi.object({status:Joi.string().valid('saved','interested','going').allow(null).required()})),handle((r)=>service.respond(kind,r.params.id,r.user.id,r.body.status)));
  return router;
}
