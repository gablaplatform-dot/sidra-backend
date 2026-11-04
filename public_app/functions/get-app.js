export async function onRequestGet(){
 try{const response=await fetch('https://sidra-api.fly.dev/get-app',{headers:{Accept:'text/html'},redirect:'manual'});if(response.status>=300 && response.status<400)return new Response('Preview temporarily unavailable.',{status:503,headers:{'Cache-Control':'no-store'}});return new Response(response.body,{status:response.status,headers:response.headers});}
 catch{return new Response('App download page temporarily unavailable. Please try again.',{status:503});}
}
export const onRequestHead=onRequestGet;
