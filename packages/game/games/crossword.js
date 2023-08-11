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

module.exports = class {
  constructor(_DB, _DIC, _ROOM) {
    this.DB = _DB;
    this.DIC = _DIC;
    this.ROOM = _ROOM;
  }

  getTitle() {
    return new Promise((resolve) => {
      this.ROOM.game.started = false;

      const means = [];
      const mdb = [];
      const my = this;

      this.DB.kkutu_cw[this.ROOM.rule.lang].find().on(($box) => {
        const boardList = [];

        const pickedMaps = [];
        let left = this.ROOM.round;
        while (left) {
          const randomIndex = Math.floor(Math.random() * $box.length);
          const pick = $box[randomIndex];
          if (!pick) return;
          $box.splice(randomIndex, 1);

          if (pickedMaps.includes(pick.map)) continue;
          means.push({});
          mdb.push({});
          pickedMaps.push(pick.map);

          boardList.push(pick.data.split('|').map((item) => item.split(',')));
          left--;
        }

        const mParser = [];
        const answers = {};
        for (const boardIndex in boardList) {
          for (const wordData of boardList[boardIndex]) {
            mParser.push(getMeaning(boardIndex, wordData));
            const [x, y, dir] = wordData;
            answers[`${boardIndex},${x},${y},${dir}`] = wordData.pop(); // remove answer from boardList
          }
        }

        this.ROOM.game.numQ = mParser.length;
        Promise.all(mParser).then(() => {
          this.ROOM.game.prisoners = {};
          this.ROOM.game.answers = answers;
          this.ROOM.game.boards = boardList;
          this.ROOM.game.means = means;
          this.ROOM.game.mdb = mdb;
          resolve('①②③④⑤⑥⑦⑧⑨⑩');
        });
      });

      function getMeaning(round, wordData) {
        return new Promise((resolve) => {
          const [, , dir, len, word] = wordData;
          let x = Number(wordData[0]);
          let y = Number(wordData[1]);

          my.DB.kkutu[my.ROOM.rule.lang].findOne(['_id', word]).on(($doc) => {
            if (!$doc) return resolve(null);

            const o = {
              count: 0,
              x: x,
              y: y,
              dir: Number(dir),
              len: Number(len),
              type: $doc.type,
              theme: $doc.theme,
              mean: $doc.mean.replace(new RegExp(word.split('').map((w) => w + '\\s?').join(''), 'g'), '★')
            };
            means[round][`${x},${y},${dir}`] = o;

            for (let i = 0; i < o.len; i++) {
              const rk = `${x},${y}`;

              if (!mdb[round][rk]) mdb[round][rk] = [];
              mdb[round][rk].push(o);

              if (o.dir) y++;
              else x++;
            }
            resolve(true);
          });
        });
      }
    });
  }

  roundReady() {
    if (this.ROOM.game.started) {
      this.ROOM.roundEnd();
      return;
    }

    this.ROOM.game.started = true;
    this.ROOM.game.roundTime = this.ROOM.time * 1000;
    this.ROOM.byMaster('roundReady', {
      seq: this.ROOM.game.seq
    }, true);
    setTimeout(() => { this.ROOM.turnStart(); }, 2400);
  }

  turnStart() {
    this.ROOM.game.late = false;
    this.ROOM.game.roundAt = Date.now();
    this.ROOM.game.qTimer = setTimeout(() => { this.ROOM.turnEnd(); }, this.ROOM.game.roundTime);
    this.ROOM.byMaster('turnStart', {
      boards: this.ROOM.game.boards,
      means: this.ROOM.game.means
    }, true);
  }

  turnEnd() {
    this.ROOM.game.late = true;
    this.ROOM.byMaster('turnEnd', {});
    this.ROOM.game._rrt = setTimeout(() => { this.ROOM.roundReady(); }, 2500);
  }

  /**
	 * submit
	 * @param client client
	 * @param text text
	 * @param {[number, string, string, string]} data [boardIndex, x, y, direction] (direction: 0 = horizontal, 1 = vertical)
	 */
  submit(client, text, data) {
    if (!this.ROOM.game.boards) return;
    if (!this.ROOM.game.answers) return;
    if (!this.ROOM.game.mdb) return;

    const isPlaying = (this.ROOM.game.seq ? this.ROOM.game.seq.includes(client.id) : false) || client.robot;
    if (!data || !isPlaying) {
      client.chat(text);
      return;
    }

    const [boardIndex, x, y, direction] = data;

    const key = `${boardIndex},${x},${y},${direction}`;
    const answer = this.ROOM.game.answers[key];
    const mbjs = this.ROOM.game.mdb[boardIndex];
    if (!mbjs) return;

    if (!answer || answer !== text) {
      client.send('turnHint', { value: text });
      return;
    }

    this.ROOM.game.prisoners[key] = text;
    this.ROOM.game.answers[key] = false;

    let jx = Number(x);
    let jy = Number(y);

    for (let i = 0; i < answer.length; i++) {
      const mbj = mbjs[`${jx},${jy}`];
      if (mbj) {
        for (const item of mbj) {
          const key = [boardIndex, item.x, item.y, item.dir];
          if (++item.count === item.len) {
            const wordOfItem = this.ROOM.game.answers[key.join(',')];
            if (wordOfItem) setTimeout(() => { this.ROOM.submit(client, wordOfItem, key); }, 1);
		 			}
        }
      }
      if (direction === '1') jy++;
      else jx++;
    }

    const score = text.length * 10;
    client.game.score += score;
    client.publish('turnEnd', {
      target: client.id,
      pos: data,
      value: text,
      score: score
    });
    client.invokeWordPiece(text, 1.2);
    if (--this.ROOM.game.numQ < 1) {
      clearTimeout(this.ROOM.game.qTimer);
      this.ROOM.turnEnd();
    }
  }

  getScore(text, delay) {}
};