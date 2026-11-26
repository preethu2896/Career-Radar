const PREFIX='CRGZ1:';
export async function compressDescription(text:string):Promise<string>{
 if(text.length<800)return text;
 const bytes=new Uint8Array(await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
 let binary='';for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));
 const encoded=PREFIX+btoa(binary);return encoded.length<text.length?encoded:text;
}
export async function expandDescription(value:string):Promise<string>{
 if(!value.startsWith(PREFIX))return value;
 const binary=atob(value.slice(PREFIX.length)),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
 const reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();let total=0,result='';const decoder=new TextDecoder();
 try{while(true){const part=await reader.read();if(part.done)break;total+=part.value.byteLength;if(total>1000000)throw Error('DESCRIPTION_TOO_LARGE');result+=decoder.decode(part.value,{stream:true});}return result+decoder.decode();}finally{await reader.cancel();}
}
