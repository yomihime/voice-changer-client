// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
import { Ok, Err } from "./results.js";
class RestClient {
  #baseUrl;
  constructor() {
    this.#baseUrl = "";
  }
  setBaseUrl = baseUrl => {
    baseUrl.endsWith("/") && (baseUrl = baseUrl.slice(0, -1));
    this.#baseUrl = baseUrl;
  };
  execFetch = async (request, responseType = "json") => new Promise(w => {
    fetch(request).then(async R => {
      if (R.ok) {
        let _;
        responseType === "blob" ? _ = await R.blob() : _ = await R.json();
        w(new Ok(_));
      } else {
        const _ = await R.text();
        try {
          const x = JSON.parse(_);
          if (x.error != null) {
            const T = JSON.parse(x.error),
              A = {
                type: "ERR_HTTP_EXCEPTION",
                status: R.status,
                statusText: R.statusText,
                code: T.code,
                reason: T.reason,
                action: T.action,
                detail: T.detail
              };
            w(new Err(A));
          } else {
            const T = {
              type: "ERR_HTTP_EXCEPTION",
              status: R.status,
              statusText: R.statusText,
              code: x.code,
              reason: "no detail",
              action: "no action",
              detail: x.detail
            };
            w(new Err(T));
          }
        } catch (x) {
          const T = {
            type: "ERR_HTTP_EXCEPTION",
            status: R.status,
            statusText: R.statusText,
            code: -1,
            reason: `JSON parse error: ${x}`,
            action: "Check server response",
            detail: _.substring(0, 200)
          };
          w(new Err(T));
        }
      }
    }).catch(R => {
      console.error(R);
      const _ = {
        type: "ERR_HTTP_EXCEPTION",
        status: 0,
        statusText: "",
        code: -1,
        reason: `${R}`,
        action: "",
        detail: null
      };
      w(new Err(_));
    });
  });
  getRequest = async (endpointPath, responseType = "json") => {
    let requestUrl = endpointPath.startsWith("/") ? `${this.#baseUrl}${endpointPath}` : `${this.#baseUrl}/${endpointPath}`;
    const request = new Request(requestUrl, {
        method: "GET"
      }),
      result = await this.execFetch(request, responseType);
    if (!result.isOk()) throw result.get();
    return result.get();
  };
  postRequest = async (endpointPath, body, responseType = "json") => {
    let requestUrl = endpointPath.startsWith("/") ? `${this.#baseUrl}${endpointPath}` : `${this.#baseUrl}/${endpointPath}`;
    const request = new Request(requestUrl, {
        method: "POST",
        body: JSON.stringify(body),
        headers: {
          "Content-Type": "application/json"
        }
      }),
      result = await this.execFetch(request, responseType);
    if (!result.isOk()) throw result.get();
    return result.get();
  };
  putRequest = async (endpointPath, body, responseType = "json") => {
    let requestUrl = endpointPath.startsWith("/") ? `${this.#baseUrl}${endpointPath}` : `${this.#baseUrl}/${endpointPath}`;
    const request = new Request(requestUrl, {
        method: "PUT",
        body: JSON.stringify(body),
        headers: {
          "Content-Type": "application/json"
        }
      }),
      result = await this.execFetch(request, responseType);
    if (!result.isOk()) throw result.get();
    return result.get();
  };
  deleteRequest = async (endpointPath, body, responseType = "json") => {
    let requestUrl = endpointPath.startsWith("/") ? `${this.#baseUrl}${endpointPath}` : `${this.#baseUrl}/${endpointPath}`,
      request;
    body != null ? request = new Request(requestUrl, {
      method: "DELETE",
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json"
      }
    }) : request = new Request(requestUrl, {
      method: "DELETE"
    });
    const result = await this.execFetch(request, responseType);
    if (!result.isOk()) throw result.get();
    return result.get();
  };
}
export { RestClient };
