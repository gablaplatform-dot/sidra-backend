export async function onRequestGet(){
 try{const response=await fetch('https://sidra-api.fly.dev/get-app',{headers:{Accept:'text/html'},redirect:'error'});return new Response(response.body,{status:response.status,headers:response.headers});}
 catch{return new Response('App download page temporarily unavailable. Please try again.',{status:503});}
}
export const onRequestHead=onRequestGet;
