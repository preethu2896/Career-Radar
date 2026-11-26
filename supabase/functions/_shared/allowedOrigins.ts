// Deployment origins extend the existing local/trusted-origin list.
export function allowedOrigins(...sources:Array<string|undefined>):string[]{
 return [...new Set(sources.flatMap(value=>(value??'').split(',')).map(value=>value.trim()).filter(Boolean))];
}
