/**
 * Rule the words! KKuTu Online
 * Copyright (C) 2017 JJoriping(op@jjo.kr)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

const Const = require('kkutu-common/const');

const BOARD_SETTINGS = { ko: {
  reg: /^[가-힣]{2,5}$/,
  additionalCondition: ['type', Const.KOR_GROUP],
  size: 64,
  maximumBlank: 5
}, en: {
  reg: /^[a-z]{4,10}$/,
  size: 100,
  maximumBlank: 10
} };

function shuffleArray(array) {
  array = [...array];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function getBoard(words, size) {
  const board = words.join('').split('');

  while (board.length < size) board.push('　');

  return shuffleArray(board).join('');
}

module.exports = class {
  constructor(_DB, _DIC, _ROOM) {
    this.DB = _DB;
    this.DIC = _DIC;
    this.ROOM = _ROOM;
  }

  async getTitle() {
    return '①②③④⑤⑥⑦⑧⑨⑩';
  }

  roundReady() {
    clearTimeout(this.ROOM.game.turnTimer);
    this.ROOM.game.round++;
    this.ROOM.game.roundTime = this.ROOM.time * 1000;

    if (this.ROOM.game.round > this.ROOM.round) {
      this.ROOM.roundEnd();
    } else {
      const boardSetting = BOARD_SETTINGS[this.ROOM.rule.lang];
      this.DB.kkutu[this.ROOM.rule.lang].find(['_id', boardSetting.reg], ['hit', { $gte: 1 }], boardSetting.additionalCondition).limit(1234).on(($docs) => {
        const wordList = [];

        $docs = shuffleArray($docs);

        let word;
        let numberOfBlank = boardSetting.size;
        while (word = $docs.shift()?._id) {
          wordList.push(word);
          numberOfBlank -= word.length;
          if (numberOfBlank <= boardSetting.maximumBlank) break;
        }

        wordList.sort((a, b) => b.length - a.length);

        this.ROOM.game.board = getBoard(wordList, boardSetting.size);
        this.ROOM.game.words = [];
        this.ROOM.byMaster('roundReady', {
          round: this.ROOM.game.round,
          board: this.ROOM.game.board
        }, true);
        this.ROOM.game.turnTimer = setTimeout(() => { this.ROOM.turnStart(); }, 2400);
      });
    }
  }

  turnStart() {
    this.ROOM.game.late = false;
    this.ROOM.game.roundAt = Date.now();
    this.ROOM.game.qTimer = setTimeout(() => { this.ROOM.turnEnd(); }, this.ROOM.game.roundTime);
    this.ROOM.byMaster('turnStart', {
      roundTime: this.ROOM.game.roundTime
    }, true);
  }

  turnEnd() {
    this.ROOM.game.late = true;

    this.ROOM.byMaster('turnEnd', {});
    this.ROOM.game._rrt = setTimeout(() => { this.ROOM.roundReady(); }, 3000);
  }

  submit(client, text) {
    if (!this.ROOM.game.words) return;
    if (!text) return;

    const isPlaying = (this.ROOM.game.seq ? this.ROOM.game.seq.includes(client.id) : false) || client.robot;
    if (!isPlaying) return client.chat(text);

    if (text.length < (this.ROOM.opts.no2 ? 3 : 2)) {
      return client.chat(text);
    }

    if (this.ROOM.game.words.includes(text)) {
      return client.chat(text);
    }

    if (!this.ROOM.game.board) return;

    this.DB.kkutu[this.ROOM.rule.lang].findOne(['_id', text]).limit(['_id', true]).on(($doc) => {
      if (!$doc) {
        client.chat(text);
        return;
      }

      let newBoard = this.ROOM.game.board;
      const characterArray = $doc._id.split('');

      for (const character of characterArray) {
        if (!newBoard.includes(character)) {
          client.chat(text);
          return;
        }
        newBoard = newBoard.replace(character, '');
      }

      // 성공
      const score = this.ROOM.getScore(text);
      this.ROOM.game.words.push(text);
      this.ROOM.game.board = newBoard;
      client.game.score += score;
      client.publish('turnEnd', {
        target: client.id,
        value: text,
        score: score
      }, true);
      client.invokeWordPiece(text, 1.1);
    });
  }

  getScore(text) {
    return Math.round(Math.pow(text.length - 1, 1.6) * 8);
  }
};