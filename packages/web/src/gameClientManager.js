const WS = require("ws");
const JLog = require("kkutu-common/jjlog");
const Const = require("kkutu-common/const");
const GLOBAL = require("../../../config/global.json");

class GameClient {
    constructor(id, url) {
        this.id = id;
        this.socket = new WS(url, { perMessageDeflate: false, rejectUnauthorized: false});

        this.socket.on('open', () => {
            JLog.info(`Game server #${this.id} connected`);
        });
        this.socket.on('error', (err) => {
            JLog.warn(`Game server #${this.id} has an error: ${err.toString()}`);
        });
        this.socket.on('close', (code) => {
            JLog.error(`Game server #${this.id} closed: ${code}`);
            this.socket.removeAllListeners();
            delete this.socket;
        });
        this.socket.on('message', (data) => {
            data = JSON.parse(data);

            switch(data.type){
                case "seek":
                    this.seek = data.value;
                    break;
                case "narrate-friend":
                    for(const i in data.list){
                        gameServers[i].send('narrate-friend', { id: data.id, s: data.s, stat: data.stat, list: data.list[i] });
                    }
                    break;
                default:
            }
        });
    }

    send(type, data) {
        if(!data) data = {};
        data.type = type;

        this.socket.send(JSON.stringify(data));
    };
}

const gameServers = Const.MAIN_PORTS.map((port) => {
    const KEY = process.env['WS_KEY'];
    const protocol = Const.IS_SECURED ? 'wss' : 'ws';
    return new GameClient(KEY, `${protocol}://${GLOBAL.GAME_SERVER_HOST}:${port}/${KEY}`);
});

exports.seek = () => {
    gameServers.forEach((server) => {
        if(server.socket) server.socket.send(`{"type":"seek"}`);
        else server.seek = undefined;
    });
};

exports.getList = () => gameServers.map((server) => server.seek);