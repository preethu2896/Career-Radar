import {readFile,writeFile} from 'node:fs/promises';
const manifest=JSON.parse(await readFile('data/company-logo-sources.json','utf8'));
const normalize=s=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim();
const logos=Object.fromEntries(manifest.map(m=>[normalize(m.company),m.path]));
const aliases={'FamPay':'Fam','Sigmoid Analytics':'Sigmoid','Rockstar India':'Rockstar Games','Rockstar Games India':'Rockstar Games','Paytm (One97 Communications)':'Paytm','Smallest.ai':'Smallest AI','Certify OS':'CertifyOS'};
for(const [alias,name]of Object.entries(aliases))if(logos[normalize(name)])logos[normalize(alias)]=logos[normalize(name)];
const code=`// Real icons cached locally. Provenance: data/company-logo-sources.json.\nconst logos: Readonly<Record<string,string>> = ${JSON.stringify(logos,null,2)};\nexport function companyLogoUrl(name: string): string | null {\n const key=name.normalize('NFKD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim();\n return logos[key] ?? null;\n}\n`;
await writeFile('src/services/companyLogos.ts',code);console.log('Mapped '+manifest.length+' confirmed company logos with explicit aliases.');
