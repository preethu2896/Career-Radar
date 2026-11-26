import {execFileSync} from 'node:child_process';
export const project='fahvirvrmozvkanmuwnu';
const quote=s=>"'"+String(s).replaceAll("'","''")+"'";
export function cli(args){return execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command','& npx supabase '+args.map(quote).join(' ')],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:180000});}
export function query(sql,readOnly=true){const raw=cli(['db','query','--remote='+project,...(readOnly?['--read-only']:['--yes']),sql]);const start=raw.indexOf('{');if(start<0)throw Error('DATABASE_RESPONSE_INVALID');return JSON.parse(raw.slice(start)).rows;}
export const sqlQuote=s=>"'"+String(s).replaceAll("'","''")+"'";
