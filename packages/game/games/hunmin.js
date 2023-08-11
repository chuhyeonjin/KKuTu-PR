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

var Const = require('kkutu-common/const');

const ROBOT_START_DELAY = [1200, 800, 400, 200, 0];
const ROBOT_TYPE_COEF = [1250, 750, 500, 250, 0];
const ROBOT_THINK_COEF = [4, 2, 1, 0, 0];
const ROBOT_HIT_LIMIT = [8, 4, 2, 1, 0];
// ㄱ, ㄴ, ㄷ, ㅁ, ㅂ, ㅅ, ㅇ, ㅈ, ㅊ, ㅌ, ㅍ, ㅎ
const HUNMIN_LIST = [4352, 4354, 4355, 4358, 4359, 4361, 4363, 4364, 4366, 4368, 4369, 4370];

module.exports = class {
  constructor(_DB, _DIC, _ROOM) {
    this.DB = _DB;
    this.DIC = _DIC;
    this.ROOM = _ROOM;
  }

  async getTitle() {
    this.ROOM.game.done = [];
    return '①②③④⑤⑥⑦⑧⑨⑩';
  }

  roundReady() {
    clearTimeout(this.ROOM.game.turnTimer);
    this.ROOM.game.round++;
    this.ROOM.game.roundTime = this.ROOM.time * 1000;
    if (this.ROOM.game.round <= this.ROOM.round) {
      this.ROOM.game.theme = getTheme(2, this.ROOM.game.done);
      this.ROOM.game.chain = [];
      if (this.ROOM.opts.mission) this.ROOM.game.mission = getMission(this.ROOM.game.theme);
      this.ROOM.game.done.push(this.ROOM.game.theme);
      this.ROOM.byMaster('roundReady', {
        round: this.ROOM.game.round,
        theme: this.ROOM.game.theme,
        mission: this.ROOM.game.mission
      }, true);
      this.ROOM.game.turnTimer = setTimeout(() => { this.ROOM.turnStart(); }, 2400);
    } else {
      this.ROOM.roundEnd();
    }
  }

  turnStart(force) {
    var speed;
    var si;

    if (!this.ROOM.game.chain) return;
    this.ROOM.game.roundTime = Math.min(this.ROOM.game.roundTime, Math.max(10000, 150000 - this.ROOM.game.chain.length * 1500));
    speed = this.ROOM.getTurnSpeed(this.ROOM.game.roundTime);
    clearTimeout(this.ROOM.game.turnTimer);
    clearTimeout(this.ROOM.game.robotTimer);
    this.ROOM.game.late = false;
    this.ROOM.game.turnTime = 15000 - 1400 * speed;
    this.ROOM.game.turnAt = (new Date()).getTime();
    this.ROOM.byMaster('turnStart', {
      turn: this.ROOM.game.turn,
      speed: speed,
      roundTime: this.ROOM.game.roundTime,
      turnTime: this.ROOM.game.turnTime,
      mission: this.ROOM.game.mission,
      seq: force ? this.ROOM.game.seq : undefined
    }, true);
    this.ROOM.game.turnTimer = setTimeout(() => { this.ROOM.turnEnd(); }, Math.min(this.ROOM.game.roundTime, this.ROOM.game.turnTime + 100));
    if (si = this.ROOM.game.seq[this.ROOM.game.turn]) {
      if (si.robot) {
        this.ROOM.readyRobot(si);
      }
    }
  }

  turnEnd() {
    var target = this.DIC[this.ROOM.game.seq[this.ROOM.game.turn]] || this.ROOM.game.seq[this.ROOM.game.turn];
    var score;

    if (this.ROOM.game.loading) {
      this.ROOM.game.turnTimer = setTimeout(() => { this.ROOM.turnEnd(); }, 100);
      return;
    }
    if (!this.ROOM.game.theme) return;

    this.ROOM.game.late = true;
    if (target) {
      if (target.game) {
        score = Const.getPenalty(this.ROOM.game.chain, target.game.score);
        target.game.score += score;
      }
    }
    getAuto.call(this, this.ROOM.game.theme, 0).then((w) => {
      this.ROOM.byMaster('turnEnd', {
        ok: false,
        target: target ? target.id : null,
        score: score,
        hint: w
      }, true);
      this.ROOM.game._rrt = setTimeout(() => { this.ROOM.roundReady(); }, 3000);
    });
    clearTimeout(this.ROOM.game.robotTimer);
  }

  submit(client, text, data) {
    var score; var l = 'ko'; var t;

    var tv = (new Date()).getTime();
    var mgt = this.ROOM.game.seq[this.ROOM.game.turn];

    if (!mgt) return;
    if (!mgt.robot) if (mgt != client.id) return;
    if (!this.ROOM.game.theme) return;
    if (isChainable(text, this.ROOM.game.theme)) {
      if (this.ROOM.game.chain.indexOf(text) == -1) {
        this.ROOM.game.loading = true;

        var my = this.ROOM;
        function onDB($doc) {
          function preApproved() {
            if (my.game.late) return;
            if (!my.game.chain) return;

            my.game.loading = false;
            my.game.late = true;
            clearTimeout(my.game.turnTimer);
            t = tv - my.game.turnAt;
            score = my.getScore(text, t);
            my.game.chain.push(text);
            my.game.roundTime -= t;
            client.game.score += score;
            client.publish('turnEnd', {
              ok: true,
              value: text,
              mean: $doc.mean,
              theme: $doc.theme,
              wc: $doc.type,
              score: score,
              bonus: (my.game.mission === true) ? score - my.getScore(text, t, true) : 0
            }, true);
            if (my.game.mission === true) {
              my.game.mission = getMission(my.game.theme);
            }
            setTimeout(() => { my.turnNext(); }, my.game.turnTime / 6);
            if (!client.robot) {
              client.invokeWordPiece(text, 1);
            }
          }
          function denied(code) {
            my.game.loading = false;
            client.publish('turnError', { code: code || 404, value: text }, true);
          }
          if ($doc) {
            if (!my.opts.injeong && ($doc.flag & Const.KOR_FLAG.INJEONG)) denied();
            else if (my.opts.strict && (!$doc.type.match(Const.KOR_STRICT) || $doc.flag >= 4)) denied(406);
            else if (my.opts.loanword && ($doc.flag & Const.KOR_FLAG.LOANWORD)) denied(405);
            else preApproved();
          } else {
            denied();
          }
        }
        this.DB.kkutu[l].findOne(['_id', text], ['type', Const.KOR_GROUP]).on(onDB);
      } else {
        client.publish('turnError', { code: 409, value: text }, true);
      }
    } else {
      client.chat(text);
    }
  }

  getScore(text, delay, ignoreMission) {
    var tr = 1 - delay / this.ROOM.game.turnTime;
    var score = Const.getPreScore(text, this.ROOM.game.chain, tr);
    var arr;

    if (!ignoreMission) {
      if (arr = text.match(new RegExp(this.ROOM.game.mission, 'g'))) {
        score += score * 0.5 * arr.length;
        this.ROOM.game.mission = true;
      }
    }
    return Math.round(score);
  }

  readyRobot(robot) {
    var level = robot.level;
    var delay = ROBOT_START_DELAY[level];
    var w;
    var text;

    getAuto.call(this, this.ROOM.game.theme, 2).then(function(list) {
      if (list.length) {
        list.sort(function(a, b) { return b.hit - a.hit; });
        if (ROBOT_HIT_LIMIT[level] > list[0].hit) denied();
        else pickList(list);
      } else denied();
    });
    var my = this;
    function denied() {
      text = `${my.ROOM.game.theme}... T.T`;
      after();
    }
    function pickList(list) {
      if (list) {
        do {
          if (!(w = list.shift())) break;
        } while (false);
      }
      if (w) {
        text = w._id;
        delay += 500 * ROBOT_THINK_COEF[level] * Math.random() / Math.log(1.1 + w.hit);
        after();
      } else denied();
    }

    function after() {
      delay += text.length * ROBOT_TYPE_COEF[level];
      setTimeout(() => { my.ROOM.turnRobot(robot, text); }, delay);
    }
  }
};
function isChainable(text, theme) {
  return toRegex(theme).exec(text) != null;
}
function toRegex(theme) {
  var arg = theme.split('').map(toRegexText).join('');
	
  return new RegExp(`^(${arg})$`);
}
function toRegexText(item) {
  var c = item.charCodeAt();
  var a = 44032 + 588 * (c - 4352); var b = a + 587;
	
  return `[\\u${a.toString(16)}-\\u${b.toString(16)}]`;
}
function getMission(theme) {
  var flag;
	
  if (!theme) return;
  if (Math.random() < 0.5) flag = 0;
  else flag = 1;
	
  return String.fromCharCode(44032 + 588 * (theme.charCodeAt(flag) - 4352));
}
function getAuto(theme, type) {
  /* type
		0 무작위 단어 하나
		1 존재 여부
		2 단어 목록
	*/
  return new Promise((resolve) => {
    var bool = type == 1;

    var aqs = [['_id', toRegex(theme)]];
    var aft;
    var raiser;
    var lst = false;

    if (!this.ROOM.opts.injeong) aqs.push(['flag', { $nand: Const.KOR_FLAG.INJEONG }]);
    if (this.ROOM.opts.loanword) aqs.push(['flag', { $nand: Const.KOR_FLAG.LOANWORD }]);
    if (this.ROOM.opts.strict) aqs.push(['type', Const.KOR_STRICT], ['flag', { $lte: 3 }]);
    else aqs.push(['type', Const.KOR_GROUP]);
    if (this.ROOM.game.chain) aqs.push(['_id', { $nin: this.ROOM.game.chain }]);
    raiser = this.DB.kkutu[this.ROOM.rule.lang].find.apply(this, aqs).limit(bool ? 1 : 123);
    switch (type) {
    case 0:
    default:
      aft = function($md) {
        resolve($md[Math.floor(Math.random() * $md.length)]);
      };
      break;
    case 1:
      aft = function($md) {
        resolve($md.length ? true : false);
      };
      break;
    case 2:
      aft = function($md) {
        resolve($md);
      };
      break;
    }
    raiser.on(aft);
  });
}
function getTheme(len, ex) {
  var res = '';
  var c; var d;
	
  while (len > 0) {
    c = String.fromCharCode(HUNMIN_LIST[Math.floor(Math.random() * HUNMIN_LIST.length)]);
    if (ex.includes(d = res + c)) continue;
    res = d;
    len--;
  }
  return res;
}