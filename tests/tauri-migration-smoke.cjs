'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),net=require('node:net');
const {spawn}=require('node:child_process');const {chromium}=require('playwright-core');
const root=path.resolve(__dirname,'..');
const output=path.resolve(process.env.TAURI_TEST_OUTPUT||path.join(root,'.runtime/migration-smoke'));
const oldExe=process.env.TAURI_OLD_EXE;
const newExe=process.env.TAURI_TEST_EXE||path.join(root,'src-tauri/target/release/voice-changer-client.exe');
const assert=require('node:assert/strict');const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(f,label){const end=Date.now()+60000;while(Date.now()<end){const v=await f();if(v)return v;await delay(100);}throw Error(label);}
async function port(){const s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;await new Promise(r=>s.close(r));return p;}
(async()=>{if(!oldExe)throw Error('TAURI_OLD_EXE must name the preserved pre-migration EXE');
fs.mkdirSync(output,{recursive:true});const profile=path.join(output,'legacy-profile-'+Date.now());
let child,browser,foreign;const requests=[];let trial=0;
async function launch(exe,offline){const debug=await port(),fd=fs.openSync(path.join(output,'process-'+(++trial)+'.log'),'w');
try{child=spawn(exe,['--profile-dir',profile,'--deny-media',...(offline?['--offline']:[])],{windowsHide:false,stdio:['ignore',fd,fd],env:{...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port='+debug}});}finally{fs.closeSync(fd);}
await until(async()=>{if(child.exitCode!==null)throw Error('Application exited '+child.exitCode);try{return(await fetch('http://127.0.0.1:'+debug+'/json/version')).ok;}catch{return false;}},'CDP not ready');
browser=await chromium.connectOverCDP('http://127.0.0.1:'+debug);
return await until(()=>browser.contexts()[0].pages().find(p=>/^http:\/\/127\.0\.0\.1:\d+\/$/.test(p.url())),'Main page missing');}
async function close(page){const exit=new Promise(r=>child.once('exit',r));await page.evaluate(()=>window.__TAURI__.window.getCurrentWindow().close()).catch(e=>{if(!page.isClosed())throw e;});await exit;await browser.close();browser=null;child=null;}
try{
let page=await launch(oldExe,true);await page.locator('#root h2').waitFor();
assert.equal(new URL(page.url()).port,'21416','legacy fixture must be at original default origin');
await until(()=>page.evaluate(async()=>{const value=await (await import("/src/storage/settings.js")).loadSettings();return value&&Object.keys(value).length>=15;}),"Old app initial settings write did not settle");
const expected={enableEchoCancellation:false,enableNoiseSuppression:false,enableNoiseSuppression2:false,realtimeOutputStatusEnabled:true,realtimeOutputStatusSendIntervalSec:2,recordForAnalysis:false,showSampleAudioButton:true,displayColorMode:'light',nodeInputGain:0.61,nodeOutputGain:0.82,nodeMonitorGain:0.13,selectedLanguage:'ja',selectedInputAudioDeviceId:'synthetic-input',outputAudio:'synthetic-output',monitorAudio:'synthetic-monitor',protocol:'rest',inputAudioType:'microphone'};
await page.evaluate(settings=>new Promise((resolve,reject)=>{const req=indexedDB.open('vcclient-settings',1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('global-settings'))req.result.createObjectStore('global-settings');};req.onsuccess=()=>{const db=req.result,tx=db.transaction('global-settings','readwrite');tx.objectStore('global-settings').put(settings,'settings');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};req.onerror=()=>reject(req.error);}),expected);
await page.reload();await page.locator("#root h2").waitFor();
await until(()=>page.evaluate(async()=>{const value=await (await import("/src/storage/settings.js")).loadSettings();return value?.nodeInputGain===0.61&&value?.outputAudio==="synthetic-output";}),"Legacy fixture did not persist the chosen settings");
const oldPersisted=await page.evaluate(async()=>await (await import("/src/storage/settings.js")).loadSettings());
assert.deepEqual(oldPersisted,expected,"Old EXE must persist the intended settings before migration");
await close(page);
assert.equal(fs.existsSync(path.join(profile,'connection-profile.json')),false,'legacy EXE must not already have native settings');
foreign=http.createServer((req,res)=>{requests.push(req.url);res.end('<script>throw Error("Unknown occupied server must never execute")</script>');});
await new Promise((resolve,reject)=>foreign.once('error',reject).listen(21416,'127.0.0.1',resolve));
page=await launch(newExe,false);
await page.locator('#backend-address:not([disabled])').waitFor({timeout:30000});
const settings=await page.evaluate(()=>window.__TAURI__.core.invoke('load_global_settings'));
assert.deepEqual(settings,expected);
assert.notEqual(new URL(page.url()).port,'21416');
assert.equal(requests.length,0,'migration must never contact the unknown process owning21416');
await page.screenshot({path:path.join(output,'first-upgrade-occupied-port.png'),animations:'disabled'});
await close(page);
const file=JSON.parse(fs.readFileSync(path.join(profile,'connection-profile.json'),'utf8'));
assert.deepEqual(file.settings,expected);
fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({passed:true,actualOldAndNewPackagedExe:true,firstUpgradeOriginalPortOccupied:true,settingsImported:true,unknownOriginRequests:requests,realAudio:false,actualAudioCapture:false,realInference:false},null,2));
console.log('First-upgrade occupied-origin migration passed');
}catch(error){const p=browser?.contexts()[0]?.pages().find(p=>/^http:\/\/127\.0\.0\.1:\d+\/$/.test(p.url()));if(p&&!p.isClosed()){await p.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({error:error.message,body:await p.locator('body').innerText().catch(()=>''),profile:await p.evaluate(()=>window.__TAURI__.core.invoke('get_connection_profile').catch(e=>String(e))).catch(e=>String(e)),requests},null,2));}throw error;
}finally{if(child&&child.exitCode===null)child.kill();await browser?.close();if(foreign){foreign.closeAllConnections();await new Promise(r=>foreign.close(r));}}})().catch(e=>{console.error(e);process.exitCode=1;});
