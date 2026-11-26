import {expect,it} from 'vitest';
import {dashboardSummary} from '../src/services/dashboardSummary.js';
import type{Application}from'../src/services/candidateWorkspace.js';
const record=(id:string,status:Application['status'],updated_at:string)=>({id,status,updated_at,title:id,company_name:'Real company'})as Application;
it('shows true zero counts and no fabricated activity for a new account',()=>{const result=dashboardSummary([]);expect(Object.values(result.counts).every(n=>n===0)).toBe(true);expect(result.recent).toEqual([]);expect(result.saved).toEqual([]);});
it('separates active stages and orders recent updates without mutating tracker records',()=>{const rows=[record('one','Saved','2026-11-20'),record('two','Interview','2026-11-25'),record('three','Preparing','2026-11-24'),record('four','Rejected','2026-11-26')];const result=dashboardSummary(rows);expect(result.total).toBe(4);expect(result.counts.Interview).toBe(1);expect(result.counts.Rejected).toBe(1);expect(result.saved.map(r=>r.id)).toEqual(['three','one']);expect(result.recent[0]?.id).toBe('four');expect(rows[0]?.id).toBe('one');});
