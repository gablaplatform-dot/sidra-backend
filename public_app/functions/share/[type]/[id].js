export async function onRequestGet({params}) {
 const type=String(params.type),id=String(params.id);
 if(!['job','event','product','service'].includes(type) || !/^[a-zA-Z0-9_-]{1,64}$/.test(id))return new Response('Not found',{status:404});
 try {const response=await fetch(`https://sidra-api.fly.dev/share/${type}/${id}`,{headers:{Accept:'text/html'},redirect:'error'});return new Response(response.body,{status:response.status,headers:response.headers});}
 catch {return new Response('Preview temporarily unavailable. Please try again.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});}
}
export const onRequestHead=onRequestGet;
