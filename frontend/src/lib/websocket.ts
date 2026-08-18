export class InspectionWebSocket {
  private socket: WebSocket | null = null;
  private url: string;
  private onMessageCb: (msg: any) => void;
  private onStatusChangeCb?: (connected: boolean) => void;
  private reconnectTimer: number | null = null;
  private isExplicitDisconnect = false;

  constructor(url: string, onMessage: (msg: any) => void, onStatusChange?: (connected: boolean) => void) {
    this.url = url;
    this.onMessageCb = onMessage;
    this.onStatusChangeCb = onStatusChange;
  }

  public connect() {
    this.isExplicitDisconnect = false;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = this.url || `${protocol}//${host}/ws`;

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.onStatusChangeCb?.(true);
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.onMessageCb(data);
        } catch (e) {
          console.error('Failed to parse WS message:', e);
        }
      };

      this.socket.onclose = () => {
        this.onStatusChangeCb?.(false);
        if (!this.isExplicitDisconnect) {
          this.scheduleReconnect();
        }
      };

      this.socket.onerror = (err) => {
        console.warn('WS error:', err);
      };
    } catch (e) {
      console.error('WS Connection error:', e);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = window.setTimeout(() => {
      this.connect();
    }, 2000);
  }

  public disconnect() {
    this.isExplicitDisconnect = true;
    if (this.reconnectTimer) window.clearTimeout(this.reconnectTimer);
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}
