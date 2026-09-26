// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
const generateTimestamp = () => {
  const S = new Date(),
    C = S.getFullYear(),
    E = String(S.getMonth() + 1).padStart(2, "0"),
    w = String(S.getDate()).padStart(2, "0"),
    R = String(S.getHours()).padStart(2, "0"),
    _ = String(S.getMinutes()).padStart(2, "0"),
    x = String(S.getSeconds()).padStart(2, "0");
  return `${C}${E}${w}_${R}${_}${x}`;
};
const downloadFile = async (S, C) => {
  try {
    const w = await (await fetch(S)).blob(),
      R = URL.createObjectURL(w),
      _ = document.createElement("a");
    _.href = R;
    _.download = C;
    _.click();
    URL.revokeObjectURL(R);
  } catch (E) {
    throw console.error(`Failed to download file ${C}:`, E), E;
  }
};
const downloadServerRecordingFiles = async (S = false, C = true) => {
  const E = generateTimestamp(),
    w = [];
  S && w.push(downloadFile("./input.wav", `input_${E}.wav`));
  C && w.push(downloadFile("./output.wav", `output_${E}.wav`));
  await Promise.all(w);
};
export { downloadServerRecordingFiles, generateTimestamp };
