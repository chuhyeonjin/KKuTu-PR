const https = require('https');
const WebSocket = require('ws');
const HttpsSecureOption = require('kkutu-common/secure');
const Const = require('kkutu-common/const');

/**
 * @param useSecure {boolean}
 * @returns {WebSocketServer}
 */
exports.createWebSocketServer =  (useSecure = Const.IS_SECURED) => {
  const port = global.test ? (Const.TEST_PORT + 416) : process.env['KKUTU_PORT'];
  if (useSecure) {
    const HTTPS_Server = https.createServer(HttpsSecureOption())
      .listen(port);

    return new WebSocket.Server({ server: HTTPS_Server });
  } else {
    return new WebSocket.Server({ port, perMessageDeflate: false });
  }
};