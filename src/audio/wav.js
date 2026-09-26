// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
const downloadAsWav = (S, C) => {
  const E = (O, H, ee) => {
      for (var te = 0; te < ee.length; te++) O.setUint8(H + te, ee.charCodeAt(te));
    },
    w = (O, H, ee) => {
      for (var te = 0; te < ee.length; te++, H += 2) {
        var ie = Math.max(-1, Math.min(1, ee[te]));
        O.setInt16(H, ie < 0 ? ie * 32768 : ie * 32767, true);
      }
    },
    R = new ArrayBuffer(44 + S.length * 2),
    _ = new DataView(R);
  E(_, 0, "RIFF");
  _.setUint32(4, 32 + S.length * 2, true);
  E(_, 8, "WAVE");
  E(_, 12, "fmt ");
  _.setUint32(16, 16, true);
  _.setUint16(20, 1, true);
  _.setUint16(22, 1, true);
  _.setUint32(24, 48e3, true);
  _.setUint32(28, 96e3, true);
  _.setUint16(32, 2, true);
  _.setUint16(34, 16, true);
  E(_, 36, "data");
  _.setUint32(40, S.length * 2, true);
  w(_, 44, S);
  const x = new Blob([_], {
      type: "audio/wav"
    }),
    T = URL.createObjectURL(x),
    A = document.createElement("a");
  A.href = T;
  A.download = C;
  document.body.appendChild(A);
  A.click();
  document.body.removeChild(A);
  URL.revokeObjectURL(T);
};
export { downloadAsWav };
