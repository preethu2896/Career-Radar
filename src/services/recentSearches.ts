export const RECENT_SEARCH_LIMIT = 5;
export function readRecentSearches(key:string):string[]{
 try{const data:unknown=JSON.parse(localStorage.getItem(key)??'[]');return Array.isArray(data)?[...new Set(data.filter((x):x is string=>typeof x==='string'&&x.trim().length>0&&x.length<=300))].slice(0,RECENT_SEARCH_LIMIT):[];}catch{return [];}
}
export function rememberSearch(key:string,value:string):string[]{
 const query=value.trim().slice(0,300);const previous=readRecentSearches(key);
 const next=query?[query,...previous.filter(x=>x.toLocaleLowerCase()!==query.toLocaleLowerCase())].slice(0,RECENT_SEARCH_LIMIT):previous;
 try{localStorage.setItem(key,JSON.stringify(next));}catch{}return next;
}
export function removeRecentSearch(key:string,value?:string):string[]{
 const next=value?readRecentSearches(key).filter(x=>x!==value):[];
 try{localStorage.setItem(key,JSON.stringify(next));}catch{}return next;
}
