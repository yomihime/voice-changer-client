// Serialize sink changes so an older setSinkId completion cannot redirect a newer route.
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
  }

  clear() {
    this.generation++;
    silenceOutput(this.element);
    this.state = { ...this.state, active: false };
  }

  route(deviceId, stream, isCurrent = () => true) {
    this.clear();
    const generation = this.generation;
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
