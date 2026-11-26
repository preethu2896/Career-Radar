import {legacyLogosById} from "./companyLogoIdentities.js";
// Real icons cached locally. Provenance: data/company-logo-sources.json.
const logos: Readonly<Record<string,string>> = {
  "66degrees": "/company-logos/66degrees.png",
  "aleph": "/company-logos/aleph.png",
  "alphagrep": "/company-logos/alphagrep.ico",
  "atlan": "/company-logos/atlan.png",
  "atlys": "/company-logos/atlys.ico",
  "certifyos": "/company-logos/certifyos.png",
  "databricks": "/company-logos/databricks.png",
  "datadog": "/company-logos/datadog.ico",
  "drivetrain": "/company-logos/drivetrain.png",
  "dun and bradstreet": "/company-logos/dun-bradstreet.png",
  "endor labs": "/company-logos/endor-labs.png",
  "equal experts": "/company-logos/equal-experts.png",
  "fam": "/company-logos/fam.ico",
  "gainsight": "/company-logos/gainsight.png",
  "gitlab": "/company-logos/gitlab.png",
  "graviton research capital": "/company-logos/graviton-research-capital.png",
  "groww": "/company-logos/groww.ico",
  "hackerrank": "/company-logos/hackerrank.png",
  "hevo data": "/company-logos/hevo-data.png",
  "interview kickstart": "/company-logos/interview-kickstart.png",
  "kantiv": "/company-logos/kantiv.png",
  "meesho": "/company-logos/meesho.png",
  "meraki labs": "/company-logos/meraki-labs.png",
  "mindtickle": "/company-logos/mindtickle.ico",
  "notion": "/company-logos/notion.png",
  "paytm": "/company-logos/paytm.png",
  "portcast": "/company-logos/portcast.png",
  "quinstreet": "/company-logos/quinstreet.png",
  "razorpay": "/company-logos/razorpay.png",
  "rockstar games": "/company-logos/rockstar-games.ico",
  "sarvam": "/company-logos/sarvam.ico",
  "schrodinger": "/company-logos/schrodinger.png",
  "sigmoid": "/company-logos/sigmoid.png",
  "smallest ai": "/company-logos/smallest-ai.png",
  "stable money": "/company-logos/stable-money.png",
  "stripe": "/company-logos/stripe.png",
  "tower research capital": "/company-logos/tower-research-capital.png",
  "z1 tech": "/company-logos/z1-tech.png",
  "zenoti": "/company-logos/zenoti.png",
  "zeta": "/company-logos/zeta.png",
  "fampay": "/company-logos/fam.ico",
  "sigmoid analytics": "/company-logos/sigmoid.png",
  "rockstar india": "/company-logos/rockstar-games.ico",
  "rockstar games india": "/company-logos/rockstar-games.ico",
  "paytm one97 communications": "/company-logos/paytm.png",
  "certify os": "/company-logos/certifyos.png"
};
export function companyLogoUrl(name: string, companyId?: string | null, logoUrl?: string | null): string | null {
 if(logoUrl && /^\/company-logos\/[a-zA-Z0-9_./-]+\.(?:png|ico|webp|svg)$/.test(logoUrl) && !logoUrl.includes('..'))return logoUrl;
 if(companyId)return legacyLogosById[companyId]??null;
 const key=name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim();
 return logos[key] ?? null;
}
