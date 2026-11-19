import EventTicketDesk from "./EventTicketDesk";
import React,{useEffect,useState} from 'react';
export default function CommunityModeration({kind,token,request}) {
 const isEvent=kind==='events';
 const [filter,setFilter]=useState({}),[selected,setSelected]=useState(null);
 const [status,setStatus]=useState(isEvent?'':'pending'),[page,setPage]=useState(1),[state,setState]=useState({items:[],total:0}),[loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState(''),[version,setVersion]=useState(0);
 useEffect(()=>{let active=true;setLoading(true);setError('');request(`/${kind}/admin?${new URLSearchParams({...filter,...(status?{status}:{}),page,limit:20})}`,{token}).then((data)=>{if(active)setState(data);}).catch((e)=>active&&setError(e.message)).finally(()=>active&&setLoading(false));return()=>{active=false;};},[kind,status,page,token,version,filter,request]);
 async function moderate(id,next){const note=window.prompt(`Review note for ${next} (optional)`, '');if(note===null)return;setBusy(id);setError('');try{await request(`/${kind}/admin/${id}`,{token,method:'PATCH',body:JSON.stringify({status:next,note})});setVersion((v)=>v+1);}catch(e){setError(e.message);}finally{setBusy('');}}
 return <div className="space-y-6"><header className="flex justify-between items-center flex-wrap gap-4"><div><p className="text-xs tracking-widest text-slate-500 uppercase">Community review</p><h1 className="text-3xl font-bold">{kind==='jobs'?'Jobs and worker posts':'Events'}</h1><p className="text-sm text-slate-500 mt-2">{isEvent?'Review events, enable ticket sales and reconcile organizer payouts.':'Only approved posts appear in public discovery. Applicants remain private to the job poster.'}</p></div><select className="border p-3 rounded-xl bg-white" value={status} onChange={(e)=>{setStatus(e.target.value);setPage(1);}}>{isEvent&&<option value="">All statuses</option>}{['pending','approved','declined','suspended','closed','cancelled'].map((s)=><option key={s}>{s}</option>)}</select></header>
 {!isEvent&&<label className="flex items-center gap-3 text-sm font-semibold">
  Post type
  <select className="rounded-lg border bg-white p-2" value={filter.jobGroup||''} onChange={(e)=>{
    setFilter(e.target.value ? {jobGroup:e.target.value} : {});
    setPage(1);
  }}>
   <option value="">All job posts</option><option value="openings">Job openings and paid tasks</option><option value="workers">Available workers</option>
  </select>
 </label>}

 {isEvent&&<form className="flex flex-wrap gap-3" onSubmit={(e)=>{e.preventDefault();const values=Object.fromEntries(new FormData(e.currentTarget));if(values.from)values.from+='T00:00:00+03:00';if(values.to)values.to+='T23:59:59.999+03:00';setPage(1);setFilter(Object.fromEntries(Object.entries(values).filter(([,v])=>v)));}}>
  <input name="q" aria-label="Search events" placeholder="Event or organizer" className="rounded-lg border p-2"/>
  <input name="category" aria-label="Category" placeholder="Category" className="rounded-lg border p-2"/>
  <input name="district" aria-label="District" placeholder="District" className="rounded-lg border p-2"/>
  <label className="grid gap-1 text-xs">Starts from<input name="from" type="date" className="rounded-lg border p-2"/></label>
  <label className="grid gap-1 text-xs">Through<input name="to" type="date" className="rounded-lg border p-2"/></label>
  <select name="ticketSales" aria-label="Online ticket sales" className="rounded-lg border p-2"><option value="">All ticket settings</option><option value="enabled">Online enabled</option><option value="disabled">Online disabled</option></select>
  <button className="rounded-lg bg-slate-900 px-4 py-2 text-white">Filter events</button>
 </form>}
 {isEvent&&selected&&<div className="space-y-2"><button className="text-sm font-semibold" onClick={()=>setSelected(null)}>Close ticket desk ×</button><EventTicketDesk key={selected.id} event={selected} token={token} request={request} onChange={()=>setVersion((v)=>v+1)}/></div>}

 {error&&<p role="alert" className="rounded-xl bg-red-50 text-red-700 p-4">{error}</p>}
 {loading?<p>Loading posts…</p>:state.items.length?<div className="grid lg:grid-cols-2 gap-5">{state.items.map((p)=><article key={p.id} className="bg-white border rounded-2xl overflow-hidden"><div className="p-6 space-y-4"><div className="flex justify-between gap-4"><div><p className="text-xs uppercase text-slate-500">{!isEvent&&<>{p.jobType==='seeking_work'?'Worker availability':p.jobType==='task'?'Paid task':'Job opening'} · </>}{p.category} · {p.district}</p><h2 className="text-xl font-bold mt-2">{p.title}</h2></div><span className="text-xs rounded-full bg-slate-100 px-3 py-2 h-fit">{p.status}</span></div><p className="text-sm">By {p.owner?.name} · {p.organization}</p><p className="whitespace-pre-wrap text-sm text-slate-600 leading-7">{p.description}</p><p className="font-semibold">{p.currency} {Number(p.payMin).toLocaleString()}{Number(p.payMax)>Number(p.payMin)?`–${Number(p.payMax).toLocaleString()}`:''}</p>{p.startsAt&&<p className="text-sm">{new Date(p.startsAt).toLocaleString()} – {new Date(p.endsAt).toLocaleString()}</p>}<p className="text-sm">{p.address}</p><div className="flex gap-3 overflow-auto">{(p.media||[]).map((m,i)=>m.type==='video'?<video className="w-48 h-40 rounded-xl" key={i} src={m.url} controls preload="metadata"/>:<a href={m.url} key={i} target="_blank" rel="noreferrer"><img className="w-40 h-40 object-cover rounded-xl" src={m.url} alt="Submitted attachment"/></a>)}</div>{p.moderationNote&&<p className="text-sm text-slate-500">Review: {p.moderationNote}</p>}<div className="flex gap-3 flex-wrap">{isEvent&&<button className="rounded-lg bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-800" onClick={()=>{setSelected(p);window.scrollTo({top:0,behavior:'smooth'});}}>Ticket desk</button>}{!['closed','cancelled'].includes(p.status)&&['approved','declined','suspended'].map((next)=><button key={next} disabled={busy===p.id} onClick={()=>moderate(p.id,next)} className={`rounded-xl px-4 py-2 font-semibold text-sm ${next==='approved'?'bg-emerald-700 text-white':'bg-slate-100 text-slate-700'}`}>{next==='approved'?'Approve':next==='declined'?'Decline':'Suspend'}</button>)}</div></div></article>)}</div>:<div className="bg-white border rounded-2xl p-12 text-center text-slate-500">No {status} posts to review.</div>}
 <footer className="flex justify-between items-center"><button disabled={page<=1} onClick={()=>setPage((p)=>p-1)}>Previous</button><span className="text-sm text-slate-500">Page {page} · {state.total} posts</span><button disabled={page*20>=state.total} onClick={()=>setPage((p)=>p+1)}>Next</button></footer></div>;
}
