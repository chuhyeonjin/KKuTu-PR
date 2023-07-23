const Const = require('kkutu-common/const');

class Data {
  constructor(data) {
    if (!data) data = {};

    this.score = data.score || 0;
    this.playTime = data.playTime || 0;
    this.connectDate = data.connectDate || 0;

    /**
     * { '게임종류': [전, 승, 총경험치, ?], ... }
     * @type {Record<string, [number, number, number, number]>}
     */
    this.record = {};
    for (const gameType of Const.GAME_TYPE) {
      this.record[gameType] = data.record ? (data.record[gameType] || [0, 0, 0, 0]) : [0, 0, 0, 0];
      if (!this.record[gameType][3]) this.record[gameType][3] = 0;
    }
  }
}

module.exports = Data;