// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
class BlockingQueue {
  _promises;
  _resolvers;
  constructor() {
    this._resolvers = [];
    this._promises = [];
  }
  _add() {
    this._promises.push(new Promise(C => {
      this._resolvers.push(C);
    }));
  }
  enqueue(C) {
    this._resolvers.length == 0 && this._add();
    this._resolvers.shift()(C);
  }
  dequeue() {
    return this._promises.length == 0 && this._add(), this._promises.shift();
  }
  isEmpty() {
    return this._promises.length == 0;
  }
  isBlocked() {
    return this._resolvers.length != 0;
  }
  get length() {
    return this._promises.length - this._resolvers.length;
  }
}
export { BlockingQueue };
