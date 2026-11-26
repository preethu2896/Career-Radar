import type {Application,ApplicationStatus} from './candidateWorkspace.js';
export function dashboardSummary(rows:Application[]){
 const counts:Record<ApplicationStatus,number>={Saved:0,Preparing:0,Applied:0,Interview:0,Offer:0,Rejected:0,Withdrawn:0,'No response':0};
 for(const row of rows)counts[row.status]++;
 const ordered=[...rows].sort((a,b)=>Date.parse(b.updated_at)-Date.parse(a.updated_at)||a.id.localeCompare(b.id));
 return{counts,saved:ordered.filter(row=>row.status==='Saved'||row.status==='Preparing').slice(0,5),recent:ordered.slice(0,5),total:rows.length};
}
