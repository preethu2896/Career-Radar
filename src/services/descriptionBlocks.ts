export type DescriptionBlock =
 | {kind:'heading';text:string}
 | {kind:'paragraph';text:string}
 | {kind:'list';ordered:boolean;items:string[]};

const label=(text:string)=>text.trim().replace(/^#{1,6}\s+|^\*\*|\*\*$/g,'').replace(/[:?\s]+$/g,'').replace(/[’‘]/g,"'");
const section=/^(?:(?:(?:key|core|primary|main|your|job|essential) )?(?:responsibilities|duties|requirements|qualifications|skills|experience)|(?:desired|preferred|minimum|required|technical|professional|basic) (?:qualifications|requirements|skills|experience)|(?:roles? and responsibilities)|what (?:you(?:'ll| will)?|we(?:'re| are)?|makes you|success)\b.{0,85}|(?:your|the) (?:impact|mission|opportunity|profile)|the ideal candidate|you will|(?:skills|experience) (?:and|&) .{1,60}|benefits|what we offer|why join.{0,60}|how to apply|hiring process|open problems|our (?:story|mission|vision|impact(?: and growth)?|product lines|culture(?: and values)?|values))$/i;
const combinedRequirements=/^(?:(?:required|desired|preferred|minimum|your) )?(?:qualifications?|requirements?|skills|experience|education)\s*(?:and|&)\s*(?:qualifications?|requirements?|skills|experience|education)$/i;
const isSection=(text:string)=>section.test(text)||combinedRequirements.test(text)||/^(?:about you|your background|key deliverables)$/i.test(text);
function listSentences(text:string):string[]{
 if(text.length<180)return [text];
 const segments=[...new Intl.Segmenter('en',{granularity:'sentence'}).segment(text)].map(s=>s.segment.trim()).filter(Boolean);
 return segments.length>1&&segments.every(s=>s.length>=20)?segments:[text];
}

export function removeOpeningAboutHeading(text:string,companyName=''):string{
 const lines=text.trim().split('\n');
 while(lines.length){const first=lines[0]!.trim();const heading=label(first);const sameName=companyName&&heading.toLowerCase()===companyName.trim().toLowerCase();
  // These inputs are already separated employer overviews, not arbitrary prose.
  if(sameName||(/^about\s+.{1,85}$/i.test(heading)&&!/[.!]$/.test(first))){lines.shift();while(lines[0]?.trim()==='')lines.shift();}else break;
 }
 return lines.join('\n').trim();
}

/** Format source text without summaries, inferred qualifications or inserted claims. */
export function descriptionBlocks(text:string):DescriptionBlock[]{
 const result:DescriptionBlock[]=[];let implicitList=false,previousBlank=true,explicitContinuation=false;
 const appendList=(value:string,ordered:boolean)=>{const last=result.at(-1);if(last?.kind==='list'&&last.ordered===ordered)last.items.push(value);else result.push({kind:'list',ordered,items:[value]});};
 const lines=text.replace(/\r\n?/g,'\n').split('\n');
 for(const raw of lines){const line=raw.trim();if(!line){previousBlank=true;explicitContinuation=false;continue;}
  const candidate=label(line);
  const bullet=line.match(/^(?:[-*•●▪‣–—]\s*|(?:\d{1,2}[.)])\s+)(\S.*)$/);
  const numbered=/^\d{1,2}[.)]\s+/.test(line);
  const inline=line.match(/^([^:]{2,90}):\s+(\S.*)$/);
  if(!bullet&&inline&&isSection(label(inline[1]!))){result.push({kind:'heading',text:label(inline[1]!)});implicitList=true;for(const sentence of listSentences(inline[2]!))appendList(sentence,false);previousBlank=false;explicitContinuation=false;continue;}
  const sourceHeading=!bullet&&candidate.length<=100&&!/[.!;]$/.test(line)&&(isSection(candidate)||(/^#{1,6}\s+/.test(line))||(/^[A-Z][A-Z\s&'’/-]{4,79}:?$/.test(line)&&candidate.split(/\s+/).length>1));
  if(sourceHeading){const last=result.at(-1);if(last?.kind!=='heading'||last.text.toLowerCase()!==candidate.toLowerCase())result.push({kind:'heading',text:candidate});implicitList=!/^our\b/i.test(candidate);previousBlank=false;explicitContinuation=false;continue;}
  if(bullet){appendList(bullet[1]!,numbered);previousBlank=false;explicitContinuation=true;continue;}
  const last=result.at(-1);
  if(last?.kind==='list'&&((explicitContinuation&&!previousBlank)||(!previousBlank&&implicitList&&/^[a-z(]/.test(line)))){last.items[last.items.length-1]+=' '+line;}
  else if(implicitList)for(const sentence of listSentences(line))appendList(sentence,false);
  else if(last?.kind==='paragraph'&&!previousBlank)last.text+=' '+line;
  else result.push({kind:'paragraph',text:line});
  previousBlank=false;explicitContinuation=false;
 }
 return result;
}
