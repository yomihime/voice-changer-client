import { VCRestClient } from "../../api/VoiceChangerApiClient.js";

export const capabilityProps = (key, alreadyDisabled = false) => {
  const capability = VCRestClient.getInstance().getCapabilities?.()[key];
  return {
    disabled: alreadyDisabled || capability?.supported === false,
    title: capability?.reason || undefined
  };
};
