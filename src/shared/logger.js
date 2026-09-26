// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
const logMessage = (S, C, ...E) => {
  S === "info" ? console.log(C, ...E) : S === "warn" ? console.warn(C, ...E) : S === "error" && console.error(C, ...E);
};
export { logMessage as log$1 };
