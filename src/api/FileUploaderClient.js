import { backendClient, BackendError } from './BackendClient.js';
// One upload operation stays bound to the target selected when it began.
class FileUploaderClient {
  #baseUrl = '';
  enableFlatPath = false;
  setBaseUrl = value => { this.#baseUrl = value.replace(/\/$/, ''); };
  setEnableFlatPath = enabled => { this.enableFlatPath = enabled; };
  generatePath = value => this.enableFlatPath ? value[0] + value.slice(1).replace(/\//g, '_') : value;
  async send(path, form, generation) {
    backendClient.assertGeneration(generation);
    const request = new Request(this.#baseUrl + this.generatePath(path), {method:'POST',body:form});
    await backendClient.request(request,{generation,consume:async response=>{
      const text = await response.text();
      if (!response.ok) throw new BackendError("upload_failed","アップロードに失敗しました。",{status:response.status,detail:text.slice(0,200)});
    }});
  }
  uploadFile = async (prefix, file, onProgress, generation = backendClient.generation) => {
    backendClient.assertGeneration(generation);
    const name=prefix+file.name;
    if (!name || /[\\/\u0000]/.test(name)) throw new BackendError('invalid_filename','ファイル名を確認してください。');
    const size=1024*1024, count=Math.ceil(file.size/size);
    onProgress(0,false);
    // Retain the existing bounded concurrency, but reject both fetch errors and stale batches.
    for (let index=0; index<count;) {
      backendClient.assertGeneration(generation);
      const batch=[];
      for (let n=0;n<10&&index<count;n++,index++) {
        const form=new FormData();
        form.append('file',file.slice(index*size,(index+1)*size));
        form.append('filename',name);form.append('index',String(index));
        batch.push(this.send('/api/uploader/upload_file_chunk',form,generation));
      }
      await Promise.all(batch);
      backendClient.assertGeneration(generation);
      onProgress(Math.floor(index/(count+1)*100),false);
    }
    return count;
  };
  concatUploadedFile = async (filename,count,generation = backendClient.generation) => {
    const form=new FormData();form.append('filename',filename);form.append('filename_chunk_num',String(count));
    await this.send('/api/uploader/concat_uploaded_file_chunk',form,generation);
  };
}
export { FileUploaderClient };
