import {supabase,getSession} from './auth.js';
export type LinkAccess={paid:boolean;remaining:number;unlocked:boolean;urls:Array<{label:string;url:string}>};
export async function requestLinkAccess(userId:string,kind:'job'|'company',id:string,consume=false):Promise<LinkAccess>{
 const session=await getSession();if(!supabase||session?.user.id!==userId)throw Error('Sign in again to continue.');
 const {data,error}=await supabase.functions.invoke('catalogue',{body:{action:'access',kind,id,consume}});
 if(error){let message='Access could not be checked. Please retry.';if(error.context instanceof Response){try{message=(await error.context.json()).error??message;}catch{}}throw Error(message);}
 return data as LinkAccess;
}
