import {chromium} from '@playwright/test';
const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const p=await b.newPage();
 for(const path of ['/','/pricing']){
  await p.goto('https://www.remjobs.works'+path,{waitUntil:'domcontentloaded',timeout:45000});await p.locator('h1').waitFor();
  const values=await p.evaluate(()=>{
   let card=document.querySelector('h3');while(card?.parentElement&&!card.textContent.includes('Apply'))card=card.parentElement;
   const nodes=location.pathname==='/'?[...card.querySelectorAll('*')]:[...document.querySelectorAll('span')].filter(e=>parseFloat(getComputedStyle(e).fontSize)>=30);
   return nodes.filter(e=>e.getClientRects().length&&[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())).slice(0,20).map(e=>({text:e.textContent.trim().slice(0,35),size:getComputedStyle(e).fontSize,line:getComputedStyle(e).lineHeight}));
  });console.log(JSON.stringify({path,values}));
 }
}finally{await b.close();}
