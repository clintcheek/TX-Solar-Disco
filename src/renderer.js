const counties = [
  ['Dallas','https://dallas.tx.ds.search.govos.com/'],
  ['Tarrant','https://tarrant.tx.publicsearch.us/'],
  ['Collin','https://collin.tx.publicsearch.us/'],
  ['Rockwall','https://www.rockwallcountytexas.com/113/County-Clerk'],
  ['Kaufman','https://www.kaufmancounty.net/2176/County-Clerk'],
  ['Van Zandt','https://www.vanzandtcounty.org/page/vanzandt.County.Clerk'],
  ['Rains','https://www.co.rains.tx.us/page/rains.County.Clerk'],
  ['Hunt','https://www.huntcounty.net/page/hunt.countyclerk'],
  ['Wood','https://www.mywoodcounty.com/page/cclerk.home'],
  ['Smith','https://www.smith-county.com/government/elected-officials/county-clerk'],
  ['Ellis','https://www.co.ellis.tx.us/81/County-Clerk'],
  ['Hopkins','https://www.hopkinscountytx.org/page/hopkins.County.Clerk'],
  ['Fannin','https://www.co.fannin.tx.us/page/fannin.County.Clerk'],
  ['Lamar','https://www.co.lamar.tx.us/page/lamar.County.Clerk'],
  ['Taylor','https://www.taylorcountytexas.org/120/County-Clerk'],
  ['Grayson','https://www.co.grayson.tx.us/page/cclerk.home'],
  ['Jones','https://www.co.jones.tx.us/page/jones.County.Clerk']
];
const portals = document.getElementById('portals');
const county = document.getElementById('county');
counties.forEach(([name,url]) => {
  const d=document.createElement('div'); d.className='portal'; d.innerHTML=`<span>${name} County</span><button class="btn" data-url="${url}">Open</button>`; portals.appendChild(d);
  const o=document.createElement('option'); o.textContent=name; o.value=name; county.appendChild(o);
});
portals.addEventListener('click',e=>{if(e.target.dataset.url) window.api.openUrl(e.target.dataset.url)});
let inputFolder='',outputFolder='';
document.getElementById('chooseInput').onclick=async()=>{const x=await window.api.chooseFolder();if(x){inputFolder=x;document.getElementById('inputFolder').value=x}};
document.getElementById('chooseOutput').onclick=async()=>{const x=await window.api.chooseFolder();if(x){outputFolder=x;document.getElementById('outputFolder').value=x}};
window.api.onProgress(p=>{document.getElementById('status').textContent=`Processing ${p.current} of ${p.total}\n${p.filename}`});
document.getElementById('start').onclick=async()=>{
  const status=document.getElementById('status');
  if(!inputFolder){status.textContent='Select an input folder first.';return}
  try{
    status.textContent='Starting extraction...';
    const r=await window.api.runExtraction({inputFolder,outputFolder,county:county.value});
    status.textContent=`Complete.\nFiles reviewed: ${r.reviewed}\nPotential matches: ${r.matched}\nBorrower rows saved: ${r.saved}\nErrors: ${r.errors.length}\n\nExcel file:\n${r.outPath}`;
  }catch(e){status.textContent=`Error: ${e.message}`}
};
