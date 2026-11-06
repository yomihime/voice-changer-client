// Shared request semantics; conversion remains inside the selected connection epoch.
import { Ok, Err } from './results.js';
import { backendClient } from './BackendClient.js';
class RestClient {
  #baseUrl = '';
  setBaseUrl = value => { this.#baseUrl=value.replace(/\/$/,''); };
  execFetch = async (request,responseType='json') => {
    const generation=backendClient.generation;
    try {
      return await backendClient.request(request,{generation,consume:async response=>{
        if(response.ok) return new Ok(responseType==='blob'?await response.blob():await response.json());
        const text=await response.text();let details={};
        try {const parsed=JSON.parse(text);details=typeof parsed.error==='string'?JSON.parse(parsed.error):(parsed.error||parsed);}catch{}
        return new Err({type:'ERR_HTTP_EXCEPTION',status:response.status,statusText:response.statusText,
          code:details.code??'http_error',reason:details.reason??'HTTP '+response.status,
          action:details.action??'',detail:details.detail??text.slice(0,200)});
      }});
    }catch(error){
      return new Err({type:'ERR_HTTP_EXCEPTION',status:error.status??0,statusText:'',
        code:error.code??'unavailable',reason:error.message||String(error),action:'',detail:null});
    }
  };
  async perform(method,endpoint,body,responseType='json') {
    const url=this.#baseUrl+(endpoint.startsWith('/')?'':'/')+endpoint;
    const options={method};
    if(body!=null){options.body=JSON.stringify(body);options.headers={'Content-Type':'application/json'};}
    const result=await this.execFetch(new Request(url,options),responseType);
    return result.get();
  }
  getRequest = (path,type='json') => this.perform('GET',path,null,type);
  postRequest = (path,body,type='json') => this.perform('POST',path,body,type);
  putRequest = (path,body,type='json') => this.perform('PUT',path,body,type);
  deleteRequest = (path,body,type='json') => this.perform('DELETE',path,body,type);
}
export { RestClient };
