import {getSession,supabase} from './auth.js';
export type AccountSettings={email:string;passwordEnabled:boolean;providers:string[];productUpdates:boolean;membership:{paid:boolean;paidUntil:string|null;remaining:number;purchasingEnabled:boolean}};
async function request<T>(userId:string,body:Record<string,unknown>):Promise<T>{
 const session=await getSession({validate:true});if(!supabase||session?.user.id!==userId)throw Error('Sign in again to continue.');
 const{data,error}=await supabase.functions.invoke('account-settings',{body});
 if(error){let message='Account settings could not be loaded. Please retry.';if(error.context instanceof Response){try{message=(await error.context.json()).error??message;}catch{}}throw Error(message);}return data as T;
}
export const loadAccountSettings=(userId:string)=>request<AccountSettings>(userId,{action:'read'});
export const saveNotificationPreference=(userId:string,productUpdates:boolean)=>request(userId,{action:'preferences',productUpdates});
export const deleteOwnAccount=(userId:string,email:string,confirmation:string)=>request(userId,{action:'delete',email,confirmation});
