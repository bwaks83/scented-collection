const SPREADSHEET_ID='1Rd-bbKTOLCommqZSFdJ2GxaEo1xXeWjwxZmL_7hnF-M';
const NOTIFICATION_EMAIL='b.alves@scentcompanyusa.com';
const HEADERS=['Received at','Submission ID','Product','Size','Container','Shape','Soap quantity','Custom packaging','Packaging colors','Custom logo','Logo color','Logo background','Background color','Comments','Email status','Fingerprint'];

// Run once in the editor, then deploy as a web app (execute as you, access Anyone).
function setup(){
 const sheet=SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Responses');
 if(!sheet)throw Error('Responses sheet not found.');
 sheet.getRange(1,1,1,HEADERS.length).setValues([HEADERS]).setFontWeight('bold').setBackground('#eeeeee').setWrap(true);
 sheet.setFrozenRows(1);
 const props=PropertiesService.getScriptProperties();
 if(!props.getProperty('INQUIRY_SECRET'))props.setProperty('INQUIRY_SECRET',Utilities.getUuid()+Utilities.getUuid());
 // Ask Google for send-mail permission now, without sending a test email.
 MailApp.getRemainingDailyQuota();
 if(!ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()==='retryPendingEmails'))ScriptApp.newTrigger('retryPendingEmails').timeBased().everyMinutes(10).create();
 console.log('Setup complete. Copy INQUIRY_SECRET from Project Settings > Script properties to Vercel.');
}
function json_(data){return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);}
function safe_(value){const s=String(value||'');return /^[\s]*[=+@-]/.test(s)?"'"+s:s;}
function doPost(e){
 let lock;
 try{
  const raw=e&&e.postData&&e.postData.contents;
  if(!raw||raw.length>20000)return json_({ok:false});
  const data=JSON.parse(raw),secret=PropertiesService.getScriptProperties().getProperty('INQUIRY_SECRET');
  if(!secret||data.secret!==secret)return json_({ok:false});
  if(!/^[0-9a-f-]{36}$/i.test(data.submissionId||'')||! /^[a-f0-9]{64}$/.test(data.fingerprint||''))return json_({ok:false});
  const a=data.answers;
  if(!a||!['Reed Diffusers','Candles','Room Sprays','Liquid Soap'].includes(a.product))return json_({ok:false});
  lock=LockService.getScriptLock();lock.waitLock(15000);
  const sheet=SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Responses');
  if(!sheet||sheet.getRange(1,16).getValue()!=='Fingerprint')throw Error('Run setup first.');
  const last=sheet.getLastRow();
  const found=last>1?sheet.getRange(2,2,last-1,1).createTextFinder(data.submissionId).matchEntireCell(true).findNext():null;
  let row;
  if(found){row=found.getRow();if(sheet.getRange(row,16).getValue()!==data.fingerprint)return json_({ok:false});}
  else{
   const values=[new Date(),data.submissionId,a.product,a.diffuser_size||a.candle_size||a.spray_size,a.diffuser_container||a.candle_container||a.spray_container,a.diffuser_shape||a.candle_shape,a.soap_quantity==='Other'?a.soap_other:a.soap_quantity,a.packaging,a.packaging_colors,a.logo,a.logo_color,a.logo_background,a.background_color,a.comments,'Pending',data.fingerprint];
   sheet.appendRow(values.map((v,i)=>i===0?v:safe_(v)));row=sheet.getLastRow();SpreadsheetApp.flush();
  }
  notify_(sheet,row);
  return json_({ok:true});
 }catch(err){console.error('Inquiry failed: '+err.message);return json_({ok:false});}
 finally{if(lock&&lock.hasLock())lock.releaseLock();}
}
function notify_(sheet,row){
 const values=sheet.getRange(row,1,1,HEADERS.length).getValues()[0];
 if(values[14]==='Sent')return;
 try{
  const lines=HEADERS.slice(0,14).map((label,i)=>label+': '+(values[i]||'Not specified'));
  MailApp.sendEmail({to:NOTIFICATION_EMAIL,subject:'New product inquiry — '+values[2],body:lines.join('\n')+'\n\nView responses: https://docs.google.com/spreadsheets/d/'+SPREADSHEET_ID+'/edit',name:'Scent Company'});
  sheet.getRange(row,15).setValue('Sent');
 }catch(err){sheet.getRange(row,15).setValue('Pending');console.error('Notification pending: '+err.message);}
}
function retryPendingEmails(){
 const lock=LockService.getScriptLock();if(!lock.tryLock(1000))return;
 try{const sheet=SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Responses');const last=sheet.getLastRow();if(last<2)return;const statuses=sheet.getRange(2,15,last-1,1).getValues();let attempts=0;for(let i=0;i<statuses.length&&attempts<20;i++){if(statuses[i][0]==='Pending'){notify_(sheet,i+2);attempts++;}}}finally{lock.releaseLock();}
}
