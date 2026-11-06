'use strict';
// Actual release WebView2, isolated profiles; no microphone, speaker or real model.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const net = require('node:net');
const vm = require('node:vm');
const {spawn} = require('node:child_process');
const {chromium} = require('playwright-core');
const root = path.resolve(__dirname, '..');
const output = path.resolve(process.env.TAURI_TEST_OUTPUT || path.join(root, '.runtime/connection-smoke'));
const exe = process.env.TAURI_TEST_EXE || path.join(root, 'src-tauri/target/release/voice-changer-client.exe');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, message, timeout = 30000) {
  const end = Date.now()+timeout;
  while (Date.now()<end) { const value = await fn(); if (value) return value; await delay(100); }
  throw Error(message);
}
async function freePort() {
  const server = net.createServer();
  await new Promise((resolve,reject) => server.once('error',reject).listen(0,'127.0.0.1',resolve));
  const port = server.address().port; await new Promise(resolve=>server.close(resolve)); return port;
}
async function run() {
  fs.mkdirSync(output,{recursive:true});
  const config = vm.runInNewContext('(' + fs.readFileSync(path.join(root,'src/hooks/useServerConfig.js'),'utf8').match(/const DefaultServerConfiguration = (\{[\s\S]*?\n\});/)[1] + ')');
  const requests = [];
  const fixture = http.createServer((req,res) => {
    requests.push(req.url);
    res.setHeader('Content-Type','application/json');
    if (req.url === '/vcc/api/configuration-manager/configuration') return res.end(JSON.stringify(config));
    if (req.url === '/vcc/api/local-voice-changer-interface/information') return res.end(JSON.stringify({local_voice_changer_interface_active:false}));
    if (req.url === '/vcc/info') { res.statusCode=404; return res.end('{}'); }
    return res.end('[]');
  });
  await new Promise(resolve=>fixture.listen(0,'127.0.0.1',resolve));
  const manual = 'http://127.0.0.1:' + fixture.address().port + '/vcc/';
  const defaultForeign = http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end('{"status":"OK","unrelated":true}');});
  const defaultAvailable = await new Promise(resolve=>{
    defaultForeign.once('error',()=>resolve(false));
    defaultForeign.listen(18888,'127.0.0.1',()=>resolve(true));
  });
  if (!defaultAvailable) throw Error('18888 is already used; default discovery scenarios require an isolated free port');
  let blocker, browser, child, launchCount=0;
  const profile = path.join(output,'profile-'+Date.now());
  const launch = async () => {
    const cdp = await freePort();
    const log=fs.openSync(path.join(output,'process-'+(++launchCount)+'.log'),'w');
    try { child=spawn(exe,['--profile-dir',profile,'--deny-media'],{windowsHide:false,stdio:['ignore',log,log],env:{...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port='+cdp}}); }
    finally {fs.closeSync(log);}
    child.once('error',e=>{throw e;});
    await until(async()=>{if(child.exitCode!==null)throw Error('EXE exited '+child.exitCode);try{return(await fetch('http://127.0.0.1:'+cdp+'/json/version')).ok;}catch{return false;}},'CDP not ready',60000);
    browser=await chromium.connectOverCDP('http://127.0.0.1:'+cdp);
    return await until(()=>browser.contexts()[0].pages().find(p=>p.url().startsWith('http://127.0.0.1:')),'No client window');
  };
  const close = async page => {
    const exited=new Promise(resolve=>child.once('exit',resolve));
    await page.evaluate(()=>window.__TAURI__.window.getCurrentWindow().close()).catch(e=>{if(!page.isClosed())throw e;});
    await exited; await browser.close(); browser=null; child=null;
  };
  const connect = async (page,address) => {
    await page.locator('#backend-address').waitFor();
    await page.locator('#backend-address:not([disabled])').waitFor();
    await page.locator('#backend-address').fill(address);
    await page.getByRole('button',{name:'接続',exact:true}).click();
  };
  try {
    let page=await launch();
    await page.locator('[data-connection-state="incompatible"]').waitFor({timeout:20000});
    await page.screenshot({path:path.join(output,'foreign-default.png'),animations:'disabled'});
    const originalOrigin=new URL(page.url()).origin;
    const imported=await page.evaluate(async()=>{
      const db=await new Promise((resolve,reject)=>{
        const req=indexedDB.open('vcclient-settings',1);
        req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('global-settings'))req.result.createObjectStore('global-settings');};
        req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
      });
      await new Promise((resolve,reject)=>{const tx=db.transaction('global-settings','readwrite');tx.objectStore('global-settings').put({nodeInputGain:0.73,selectedLanguage:'ja'},'settings');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});
      db.close();
      return (await import('/src/storage/settings.js')).loadSettings();
    });
    assert.equal(imported.nodeInputGain,0.73);
    assert.equal((await page.evaluate(()=>window.__TAURI__.core.invoke('load_global_settings'))).nodeInputGain,0.73);
    await connect(page,manual); await page.locator('#root h2').waitFor();
    await page.screenshot({path:path.join(output,'connected-2x.png'),animations:'disabled'});
    // Save after mounting, so background defaults cannot race the explicit preserved setting.
    await page.evaluate(()=>window.__TAURI__.core.invoke('save_global_settings',{settings:{nodeInputGain:0.73,selectedLanguage:'ja'}}));
    assert.ok(requests.includes('/vcc/api/configuration-manager/configuration'));
    await close(page);
    blocker=net.createServer(socket=>socket.destroy());
    const oldPort=+new URL(originalOrigin).port;
    await new Promise((resolve,reject)=>blocker.once('error',reject).listen({host:'127.0.0.1',port:oldPort,exclusive:true},resolve));
    const beforeRestart=requests.length;
    page=await launch();
    await page.locator('[data-connection-state="incompatible"]').waitFor({timeout:20000});
    const newOrigin=new URL(page.url()).origin;
    assert.notEqual(newOrigin,originalOrigin);
    assert.equal(await page.locator('#backend-address').inputValue(),manual);
    assert.equal(requests.length,beforeRestart,'saved address must not bypass default18888');
    assert.equal((await page.evaluate(()=>window.__TAURI__.core.invoke('load_global_settings'))).nodeInputGain,0.73);
    await page.screenshot({path:path.join(output,'occupied-port-saved-settings.png'),animations:'disabled'});
    // Real isolated VCC is not a mock. Recognition does not start/load audio or a model.
    if (process.env.VCC_TEST_URL) {
      await connect(page,process.env.VCC_TEST_URL);
      await page.locator('[data-connection-state="ready"]').waitFor();
      assert.match(await page.locator('#root').innerText(),/VCC/);
      await page.screenshot({path:path.join(output,'real-vcc-recognized.png'),animations:'disabled'});
    }
    await close(page);
    defaultForeign.closeAllConnections();
    await new Promise(resolve => defaultForeign.close(resolve));
    page = await launch();
    await page.locator('[data-connection-state="needs-address"]').waitFor({timeout:20000});
    await page.locator('#backend-address:not([disabled])').waitFor();
    await page.screenshot({path:path.join(output,'no-backend.png'),animations:'disabled'});
    defaultForeign.removeAllListeners('request');
    defaultForeign.on('request', (req, res) => {
      res.setHeader('Content-Type','application/json');
      res.end(JSON.stringify({status:'OK',modelSlots:[],gpus:[],python:'fixture',
        voiceChangerParams:{model_dir:'fixture'},serverAudioStated:0}));
    });
    await new Promise((resolve,reject) => defaultForeign.once('error',reject).listen(18888,'127.0.0.1',resolve));
    await page.getByRole('button',{name:'localhost:18888 を再試行',exact:true}).click();
    await page.locator('[data-connection-state="ready"]').waitFor();
    await page.screenshot({path:path.join(output,'late-backend-retry.png'),animations:'disabled'});
    await close(page);
    const result={passed:true,launchArguments:'no --backend or --port; isolated --profile-dir and --deny-media only',
      defaultRejectsArbitrary200:true,savedAddressPrefillOnly:true,basePathForwarded:true,automaticPortFallback:true,
      originalOrigin,newOrigin,legacyIndexedDbImported:true,nativeSettingsPreserved:true,actualPackagedWebView2:true,
      realVccRecognized:!!process.env.VCC_TEST_URL,noBackendEditable:true,lateBackendRetry:true,
      realAudio:false,actualAudioCapture:false,realInference:false};
    fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(result,null,2));
    console.log(JSON.stringify(result,null,2));
  } catch (error) {
    const debugPage=browser?.contexts()[0]?.pages()[0];
    if(debugPage&&!debugPage.isClosed()){
      await debugPage.screenshot({path:path.join(output,"failure.png")}).catch(()=>{});
      fs.writeFileSync(path.join(output,"failure.json"),JSON.stringify({error:error.message,url:debugPage.url(),body:await debugPage.locator("body").innerText().catch(()=>""),state:await debugPage.evaluate(async()=>({tauri:!!window.__TAURI__,html:document.getElementById("root")?.innerHTML,profile:await window.__TAURI__?.core.invoke("get_connection_profile").catch(e=>String(e))})).catch(e=>String(e))},null,2));
    }
    throw error;
  } finally {
    if(child&&child.exitCode===null) {child.kill(); await delay(500);}
    await browser?.close();
    if(blocker) await new Promise(resolve=>blocker.close(resolve));
    defaultForeign.closeAllConnections(); await new Promise(resolve=>defaultForeign.close(resolve));
    fixture.closeAllConnections(); await new Promise(resolve=>fixture.close(resolve));
  }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
