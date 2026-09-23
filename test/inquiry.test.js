const {test}=require('node:test');
const assert=require('node:assert/strict');
const handler=require('../api/inquiry');
const {cleanAnswers}=handler;
function res(){return {headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.code=n;return this},json(v){this.data=v;return this}}}
test('Only selected product and relevant customization answers survive',()=>{
 const a=cleanAnswers({company:'Test Company',respondent:'Test Person',product:'Room Sprays',spray_size:'100ml (3.38 oz)',candle_size:'500g',logo:'No',logo_color:'red',logo_background:'Yes',background_color:'blue',packaging:'No',packaging_colors:'green'});
 assert.equal(a.spray_size,'100ml (3.38 oz)');for(const k of ['candle_size','logo_color','logo_background','background_color','packaging_colors'])assert.equal(a[k],undefined);
});
test('Invalid input and soap quantities rejected',()=>{
 for(const data of [null,{company:'Test Company',respondent:'Test Person',product:'x'},{company:'Test Company',respondent:'Test Person',product:'Candles',comments:'a'.repeat(3001)},{company:'Test Company',respondent:'Test Person',product:'Liquid Soap',soap_quantity:'Other',soap_other:'499'}])assert.throws(()=>cleanAnswers(data));
 assert.equal(cleanAnswers({company:'Test Company',respondent:'Test Person',product:'Liquid Soap',soap_quantity:'Other',soap_other:'500'}).soap_other,'500');
});
test('API returns success only after upstream confirms storage',async()=>{
 process.env.GOOGLE_APPS_SCRIPT_URL='https://script.google.com/macros/s/test/exec';process.env.INQUIRY_SECRET='a'.repeat(40);
 const original=global.fetch;
 const req={method:'POST',headers:{host:'scented-collection.vercel.app',origin:'https://scented-collection.vercel.app','content-type':'application/json'},body:{submissionId:'12345678-1234-1234-1234-123456789abc',answers:{company:'Test Company',respondent:'Test Person',product:'Candles'}}};
 try{
 global.fetch=async(url,opts)=>{const body=JSON.parse(opts.body);assert.equal(body.secret,process.env.INQUIRY_SECRET);assert.equal(body.fingerprint.length,64);return {ok:true,json:async()=>({ok:true})}};
 let r=res();await handler(req,r);assert.equal(r.code,200);assert.equal(r.data.ok,true);
 global.fetch=async()=>({ok:true,json:async()=>({ok:false})});r=res();await handler(req,r);assert.equal(r.code,502);assert.equal(r.data.ok,undefined);
 global.fetch=async()=>{throw Error('network')};r=res();await handler(req,r);assert.equal(r.code,502);
 r=res();await handler({...req,headers:{...req.headers,origin:'https://other.example'}},r);assert.equal(r.code,403);
 delete process.env.INQUIRY_SECRET;r=res();await handler(req,r);assert.equal(r.code,503);
 }finally{global.fetch=original;delete process.env.GOOGLE_APPS_SCRIPT_URL;delete process.env.INQUIRY_SECRET;}
});

test('Identification is required and trimmed',()=>{for(const company of ['', '   '])assert.throws(()=>cleanAnswers({company,respondent:'Person',product:'Candles'}));assert.throws(()=>cleanAnswers({company:'Company',product:'Candles'}));const a=cleanAnswers({company:' Acme ',respondent:' Ana ',product:'Candles'});assert.equal(a.company,'Acme');assert.equal(a.respondent,'Ana');});
