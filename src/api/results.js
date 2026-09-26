// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
class RestResult {}
class Ok extends RestResult {
  value;
  constructor(C) {
    super();
    this.value = C;
  }
  isOk() {
    return true;
  }
  get() {
    return this.value;
  }
}
class Err extends RestResult {
  error;
  constructor(C) {
    super();
    this.error = C;
  }
  isOk() {
    return false;
  }
  get() {
    throw this.error;
  }
}
export { Ok, Err };
