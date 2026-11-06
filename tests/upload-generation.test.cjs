'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
test('a cancelled upload cannot send its next batch or concat to another backend',async()=>{
  const {backendClient}=await import('../src/api/BackendClient.js');
  const {FileUploaderClient}=await import('../src/api/FileUploaderClient.js');
  const original=global.fetch;const pending=[],targets=[];
  let marker='old';
  global.fetch=async request=>{targets.push(marker);return new Promise(resolve=>pending.push(()=>resolve(new Response('ok'))));};
  try{
    const client=new FileUploaderClient();client.setBaseUrl('http://localhost:18000/');
    const generation=backendClient.generation;
    const file=new File([new Uint8Array(11*1024*1024)],'synthetic.pth');
    const result=client.uploadFile('',file,()=>{},generation);
    assert.equal(pending.length,10);
    marker='new';backendClient.invalidate();pending.forEach(f=>f());
    await assert.rejects(result,error=>error.code==='stale_session');
    assert.deepEqual(targets,Array(10).fill('old'));
    await assert.rejects(client.concatUploadedFile('synthetic.pth',11,generation),error=>error.code==='stale_session');
    assert.equal(targets.length,10);
  }finally{global.fetch=original;}
});
test('an HTTP upload failure rejects instead of remaining pending or succeeding',async()=>{
  const {FileUploaderClient}=await import('../src/api/FileUploaderClient.js');
  const original=global.fetch;
  global.fetch=async()=>new Response('denied',{status:413});
  try{
    const client=new FileUploaderClient();client.setBaseUrl('http://localhost:18000');
    await assert.rejects(client.uploadFile('',new File(['x'],'synthetic.pth'),()=>{}),error=>error.code==='upload_failed'&&error.status===413);
    await assert.rejects(client.uploadFile('',new File(['x'],'../escape.pth'),()=>{}),error=>error.code==='invalid_filename');
  }finally{global.fetch=original;}
});
