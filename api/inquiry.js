const { createHash } = require('node:crypto');
const PRODUCTS=['Reed Diffusers','Candles','Room Sprays','Liquid Soap'];
const COMMON=['company','respondent','product','packaging','packaging_colors','logo','logo_color','logo_background','background_color','comments'];
const FIELDS={ 'Reed Diffusers':['diffuser_size','diffuser_container','diffuser_shape'],Candles:['candle_size','candle_container','candle_shape'],'Room Sprays':['spray_size','spray_container'],'Liquid Soap':['soap_quantity','soap_other'] };
function cleanAnswers(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||!PRODUCTS.includes(input.product))throw Error('Choose a product.');
 const out={};
 for(const key of [...COMMON,...FIELDS[input.product]]){
  const value=input[key]??'';
  if(typeof value!=='string'||value.length>(key==='comments'?3000:300))throw Error('Invalid answer.');
  out[key]=value.trim();
 }
 if(!out.company||!out.respondent)throw Error('Enter your company name and your name.');
 for(const key of ['packaging','logo','logo_background'])if(!['','Yes','No','Not sure yet'].includes(out[key]))throw Error('Invalid choice.');
 if(out.packaging!=='Yes')delete out.packaging_colors;
 if(out.logo!=='Yes'){delete out.logo_color;delete out.logo_background;delete out.background_color;}
 else if(out.logo_background!=='Yes')delete out.background_color;
 if(out.product==='Liquid Soap'){
  if(!['','500 (minimum quantity)','Other'].includes(out.soap_quantity))throw Error('Invalid quantity.');
  if(out.soap_quantity==='Other'&&(!/^\d+$/.test(out.soap_other)||Number(out.soap_other)<500))throw Error('Minimum order: 500 units.');
  if(out.soap_quantity!=='Other')delete out.soap_other;
 }
 return out;
}
function configured(){return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(process.env.GOOGLE_APPS_SCRIPT_URL||'')&&(process.env.INQUIRY_SECRET||'').length>=32;}
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method==='GET')return res.status(200).json({ready:configured()});
 if(req.method!=='POST'){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed.'});}
 if(!configured())return res.status(503).json({error:'Online submission is not available yet. Please try again later.'});
 if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host)return res.status(403).json({error:'Invalid origin.'});}catch{return res.status(403).json({error:'Invalid origin.'});}}
 let body,answers;
 try{
  if(!String(req.headers['content-type']||'').startsWith('application/json'))throw Error('Expected JSON.');
  if(Number(req.headers['content-length'])>16000)throw Error('Request too large.');
  body=typeof req.body==='string'?JSON.parse(req.body):req.body;
  if(JSON.stringify(body).length>16000)throw Error('Request too large.');
  if(!/^[0-9a-f-]{36}$/i.test(body?.submissionId||''))throw Error('Invalid submission ID.');
  answers=cleanAnswers(body.answers);
 }catch(e){return res.status(400).json({error:e.message||'Invalid inquiry.'});}
 const fingerprint=createHash('sha256').update(JSON.stringify(answers)).digest('hex');
 try{
  const upstream=await fetch(process.env.GOOGLE_APPS_SCRIPT_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:process.env.INQUIRY_SECRET,submissionId:body.submissionId,fingerprint,answers}),signal:AbortSignal.timeout(25000),redirect:'follow'});
  const result=await upstream.json();
  if(!upstream.ok||result.ok!==true)throw Error('Google did not confirm storage.');
  return res.status(200).json({ok:true,submissionId:body.submissionId});
 }catch{return res.status(502).json({error:'We could not confirm your inquiry. Your answers are still here. Please try again.'});}
};
module.exports.cleanAnswers=cleanAnswers;
