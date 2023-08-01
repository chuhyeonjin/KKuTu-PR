const WebServer = class {
  constructor(socket, DIC, narrate) {
    this.socket = socket;
    this.DIC = DIC;
    this.narrate = narrate;
    this.socket.on('message', (msg) => { this.onWebServerMessage(msg); });
  }
 
  send(type, data) {
    const r = data || {};
    r.type = type;
    if (this.socket.readyState == 1) this.socket.send(JSON.stringify(r));
  }

  onWebServerMessage(msg) {
    try {
      msg = JSON.parse(msg);
    } catch (e) {
      return;
    }

    switch (msg.type) {
    case 'seek':
      this.send('seek', { value: Object.keys(this.DIC).length });
      break;
    case 'narrate-friend':
      this.narrate(msg.list, 'friend', { id: msg.id, s: msg.s, stat: msg.stat });
      break;
    default:
    }
  }
};

module.exports = WebServer;