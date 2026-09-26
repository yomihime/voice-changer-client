// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
class FileUploaderClient {
  #baseUrl;
  enableFlatPath = false;
  constructor() {
    this.#baseUrl = "";
  }
  setBaseUrl = baseUrl => {
    baseUrl.endsWith("/") && (baseUrl = baseUrl.slice(0, -1));
    this.#baseUrl = baseUrl;
  };
  setEnableFlatPath = enabled => {
    this.enableFlatPath = enabled;
  };
  generatePath = endpointPath => this.enableFlatPath ? endpointPath[0] + endpointPath.slice(1).replace(/\//g, "_") : endpointPath;
  uploadFile = async (filenamePrefix, file, onProgress) => {
    const uploadUrl = this.#baseUrl + this.generatePath("/api/uploader/upload_file_chunk");
    onProgress(0, false);
    const chunkSize = 1024 * 1024;
    let chunkIndex = 0;
    const fileSize = file.size,
      uploadFilename = filenamePrefix + file.name,
      chunkCount = Math.ceil(fileSize / chunkSize);
    for (;;) {
      const H = [];
      for (let ee = 0; ee < 10 && !(chunkIndex * chunkSize >= fileSize); ee++) {
        const te = file.slice(chunkIndex * chunkSize, (chunkIndex + 1) * chunkSize),
          ie = new Promise(ne => {
            const ae = new FormData();
            ae.append("file", new Blob([te]));
            ae.append("filename", `${uploadFilename}`);
            ae.append("index", `${chunkIndex}`);
            const se = new Request(uploadUrl, {
              method: "POST",
              body: ae
            });
            fetch(se).then(async ce => {
              console.log(await ce.text());
              ne();
            });
          });
        chunkIndex += 1;
        H.push(ie);
      }
      if (await Promise.all(H), chunkIndex * chunkSize >= fileSize) break;
      onProgress(Math.floor(chunkIndex / (chunkCount + 1) * 100), false);
    }
    return chunkCount;
  };
  concatUploadedFile = async (filename, chunkCount) => {
    const concatUrl = this.#baseUrl + this.generatePath("/api/uploader/concat_uploaded_file_chunk");
    await new Promise(R => {
      const _ = new FormData();
      _.append("filename", filename);
      _.append("filename_chunk_num", "" + chunkCount);
      const x = new Request(concatUrl, {
        method: "POST",
        body: _
      });
      fetch(x).then(async T => {
        console.log(await T.text());
        R();
      });
    });
  };
}
export { FileUploaderClient };
