// Serialize sink changes so an older setSinkId completion cannot redirect a newer route.
const objectTokens = new WeakMap();
const observations = new WeakMap();
let nextObjectToken = 1;
const token = object => {
  if (!object || typeof object !== 'object') return null;
  if (!objectTokens.has(object)) objectTokens.set(object, nextObjectToken++);
  return objectTokens.get(object);
};
const finite = value => Number.isFinite(value) ? value : null;
const readElement = element => ({
  elementToken: token(element), streamToken: token(element?.srcObject),
  sinkId: typeof element?.sinkId === 'string' ? element.sinkId : null,
  muted: typeof element?.muted === 'boolean' ? element.muted : null,
  volume: finite(element?.volume), paused: typeof element?.paused === 'boolean' ? element.paused : null,
  readyState: finite(element?.readyState), currentTime: finite(element?.currentTime),
  errorCode: finite(element?.error?.code),
  streamActive: typeof element?.srcObject?.active === 'boolean' ? element.srcObject.active : null,
  tracks: element?.srcObject?.getAudioTracks?.().map(track => ({
    readyState: track.readyState ?? null,
    enabled: typeof track.enabled === 'boolean' ? track.enabled : null,
    muted: typeof track.muted === 'boolean' ? track.muted : null
  })) ?? []
});
const observeElement = element => {
  if (observations.has(element)) return observations.get(element);
  const events = [];
  observations.set(element, events);
  for (const type of ['play', 'playing', 'pause', 'error', 'ended', 'emptied']) {
    element.addEventListener?.(type, event => {
      events.push({ type, timestamp: Date.now(), ...readElement(event.currentTarget) });
      if (events.length > 32) events.shift();
    });
  }
  return events;
};

export const silenceOutput = element => {
  if (!element) return;
  element.muted = true;
  element.volume = 0;
  element.pause();
  element.srcObject = null;
};

export class OutputDeviceRouter {
  constructor(element, mediaDevices = navigator.mediaDevices) {
    this.element = element;
    this.mediaDevices = mediaDevices;
    this.generation = 0;
    this.pending = Promise.resolve();
    this.state = { deviceId: 'none', active: false, error: null };
    this.configuredStream = null;
    this.events = observeElement(element);
  }

  clear() {
    this.generation++;
    silenceOutput(this.element);
    this.state = { ...this.state, active: false };
    this.configuredStream = null;
  }

  getDiagnostics() {
    return { routeGeneration: this.generation,
      configuredStreamToken: token(this.configuredStream),
      sourceMatchesConfiguredStream: this.configuredStream != null && this.element.srcObject === this.configuredStream,
      element: readElement(this.element), events: this.events.map(event => ({ ...event })) };
  }

  route(deviceId, stream, isCurrent = () => true) {
    this.clear();
    const generation = this.generation;
    this.configuredStream = stream ?? null;
    const current = () => generation === this.generation && isCurrent();
    this.state = { deviceId, active: false, error: null };
    const route = async () => {
      if (!current() || !deviceId || deviceId === 'none' || !stream) return false;
      try {
        const devices = await this.mediaDevices.enumerateDevices();
        if (!current()) return false;
        const outputs = devices.filter(device => device.kind === 'audiooutput');
        if (!outputs.some(device => device.deviceId === deviceId)) throw new Error('選択した出力デバイスが見つかりません。');
        if (typeof this.element.setSinkId !== 'function') throw new Error('この環境では出力デバイスを指定できません。');
        await this.element.setSinkId(deviceId);
        if (!current()) return false;
        if (this.element.sinkId != null && this.element.sinkId !== deviceId) throw new Error('出力デバイスの切り替えを確認できません。');
        this.element.srcObject = stream;
        // Keep the element muted while play() can still reject.
        await this.element.play();
        if (!current()) return false;
        this.element.volume = 1;
        this.element.muted = false;
        this.state = { deviceId, active: true, error: null };
        return true;
      } catch (error) {
        if (current()) {
          silenceOutput(this.element);
          this.state = { deviceId, active: false, error: error.message };
          throw error;
        }
        return false;
      } finally {
        // The next route is queued behind this operation, so clearing a stale
        // completion cannot mute a newer, successfully configured sink.
        if (!current()) silenceOutput(this.element);
      }
    };
    this.pending = this.pending.catch(() => {}).then(route);
    return this.pending;
  }
}
