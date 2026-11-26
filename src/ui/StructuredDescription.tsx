import {descriptionBlocks} from '../services/descriptionBlocks.js';

export function StructuredDescription({text}:{text:string}){
 return <div className="sf-description sf-rich-description">{descriptionBlocks(text).map((block,i)=>{
  if(block.kind==='heading')return <h3 key={i}>{block.text}</h3>;
  if(block.kind==='paragraph')return <p key={i}>{block.text}</p>;
  const items=block.items.map((item,index)=><li key={index}>{item}</li>);
  return block.ordered?<ol key={i}>{items}</ol>:<ul key={i}>{items}</ul>;
 })}</div>;
}
