import type {ReactNode} from 'react';
import './informationPages.css';
export function InformationLayout({title,intro,children,links=[]}:{title:string;intro:string;children:ReactNode;links?:Array<[string,string]>}){
 return <main className="cr-information-page"><div className="cr-information-container"><header className="cr-information-heading"><h1>{title}</h1><p>{intro}</p></header><div className={'cr-information-layout'+(links.length?'':' is-single')}>
 {links.length?<nav className="cr-information-index" aria-label="On this page">{links.map(([id,label])=><a href={'#'+id} key={id}>{label}</a>)}</nav>:null}
 <article className="cr-information-content">{children}</article></div></div></main>;
}
