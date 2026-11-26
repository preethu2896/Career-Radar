import {hasCareerPortal,careerPortalLinks} from '../src/services/directoryPolicy.ts';
import { readFile, writeFile } from 'node:fs/promises';
// Keep the original research dataset intact; ship only the fields discovery uses.
const rows = JSON.parse(await readFile('public/data/company-index.json', 'utf8'));
const compact = rows.filter(hasCareerPortal).map(({ id, name, website, careerUrls, industry, headquarters, cityAssociations, identityReviewStatuses, description, suppliedSources, addedAt, feedBoardIds, profilePath, sourceRows }) => ({
  id, name, website, description, suppliedSources, addedAt, feedBoardIds, profilePath, careerUrls: careerPortalLinks({website,careerUrls,sourceRows}).slice(0, 5), industry, headquarters,
  cityAssociations: [...new Map(cityAssociations.map(row => [JSON.stringify([row.city, row.datasetCity]), { city: row.city, datasetCity: row.datasetCity }])).values()],
  identityReviewStatuses: [...new Set(identityReviewStatuses)],
}));
await writeFile('public/data/discovery-companies.json', JSON.stringify(compact));
console.log(JSON.stringify({ companies: compact.length, discoveryBytes: Buffer.byteLength(JSON.stringify(compact)) }));

await writeFile("public/data/company-summary.json",JSON.stringify({total:compact.length,newlyAdded:compact.filter(row=>row.addedAt).length}));

await writeFile("public/data/company-search.json",JSON.stringify([...new Set(compact.map(row=>row.name))].sort((a,b)=>a.localeCompare(b))));

await writeFile("public/data/company-search-options.json",JSON.stringify({names:[...new Set(compact.map(row=>row.name))].sort((a,b)=>a.localeCompare(b)),locations:[...new Set(compact.flatMap(row=>row.cityAssociations.flatMap(city=>[city.city,city.datasetCity]).filter(Boolean)))].sort(),industries:[...new Set(compact.map(row=>row.industry).filter(Boolean))].sort()}));
