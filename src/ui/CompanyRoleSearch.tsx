import {CITY_SUGGESTIONS} from '../services/directoryPolicy.js';
import {useMemo,useState} from 'react';
import {ROLE_TITLES} from '../services/careerCatalog.js';
import {loadCompanySearchOptions} from '../services/searchCatalog.js';
import {SearchAutocomplete} from './SearchAutocomplete.js';
export function CompanyRoleSearch({value,onChange,label,placeholder,kind='both',nameOnly=false,invalid=false,errorId}:{value:string;onChange:(value:string)=>void;label:string;placeholder?:string;kind?:'company'|'role'|'both';nameOnly?:boolean;invalid?:boolean;errorId?:string|undefined}){
 const [names,setNames]=useState<string[]>([]);const [locations,setLocations]=useState<string[]>([...CITY_SUGGESTIONS]);const [industries,setIndustries]=useState<string[]>([]);
 const choices=useMemo(()=>[...(kind==='role'?[]:names.map(value=>({value,kind:'Company'}))),...(kind==='company'?[]:ROLE_TITLES.map(value=>({value,kind:'Role'}))),...(kind==='role'||nameOnly?[]:locations.map(value=>({value,kind:'Location'}))),...(kind==='company'&&!nameOnly?industries.map(value=>({value,kind:'Industry'})):[])],[names,kind,locations,industries,nameOnly]);
 return <SearchAutocomplete invalid={invalid} errorId={errorId} required={kind!=='both'} maxLength={kind==='company'?160:kind==='role'?200:300} value={value} onChange={onChange} label={label} placeholder={placeholder??label} choices={choices} onFocus={()=>{if(kind!=='role'&&!names.length)void loadCompanySearchOptions().then(catalog=>{setNames(catalog.names);setLocations([...new Set([...CITY_SUGGESTIONS,...catalog.locations])]);setIndustries(catalog.industries);}).catch(()=>{});}}/>;
}
