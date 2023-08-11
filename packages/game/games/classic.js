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

const ROBOT_START_DELAY = [1200, 800, 400, 200, 0];
const ROBOT_TYPE_COEF = [1250, 750, 500, 250, 0];
const ROBOT_THINK_COEF = [4, 2, 1, 0, 0];
const ROBOT_HIT_LIMIT = [8, 4, 2, 1, 0];
const ROBOT_LENGTH_LIMIT = [3, 4, 9, 99, 99];
// 두음법칙
const RIEUL_TO_NIEUN = [4449, 4450, 4457, 4460, 4462, 4467];
const RIEUL_TO_IEUNG = [4451, 4455, 4456, 4461, 4466, 4469];
const NIEUN_TO_IEUNG = [4455, 4461, 4466, 4469];

/**
 * 키 값을 리턴합니다.
 *
 * 어인정 -> X, 우리말 -> L, 깐깐 -> S
 * @param opts
 * @returns {'' | 'X' | 'L' | 'S', 'XL' | 'XS' | 'LS' | 'XLS'}
 */
function keyByOptions(opts) {
  const arr = [];

  if (opts.injeong) arr.push('X');
  if (opts.loanword) arr.push('L');
  if (opts.strict) arr.push('S');
  return arr.join('');
}

/**
 * Shuffle array
 * @template T
 * @param arr {T[]}
 * @returns {T[]}
 */
function shuffle(arr) {
  const copyOfArr = [...arr];
  copyOfArr.sort(() => Math.random() - 0.5);
  return copyOfArr;
}

function getChar(text, gameMode) {
  switch (Const.GAME_TYPE[gameMode]) {
  case 'EKT': return text.slice(text.length - 3);
  case 'ESH':
  case 'KKT':
  case 'KSH': return text.slice(-1);
  case 'KAP': return text.charAt(0);
  }
}

/**
 * 두음법칙
 * @param char {string}
 * @param gameMode {string}
 * @returns {undefined | string}
 */
function getSubChar(char, gameMode) {
  switch (Const.GAME_TYPE[gameMode]) {
  case 'EKT':
    if (char.length > 2) return char.slice(1);
    break;
  case 'KKT': case 'KSH': case 'KAP': {
    const k = char.charCodeAt() - 0xAC00;
    // U+AC00..U+D7AF 를 벗어나는 경우 (유니코드 Hangul Syllables)
    if (k < 0 || k > 11171) break;
    // ㄱ -> 0 과 같이 표현된 [초성, 중성, 종성]
    const ca = [Math.floor(k / 28 / 21), Math.floor(k / 28) % 21, k % 28];
    // 유니코드 Hangul Jamo 에서의 [초성, 중성, 종성]
    const cb = [ca[0] + 0x1100, ca[1] + 0x1161, ca[2] + 0x11A7];

    let 두음법칙을_적용했는가 = false;
    if (cb[0] == 4357) { // ㄹ에서 ㄴ, ㅇ
      두음법칙을_적용했는가 = true;
      if (RIEUL_TO_NIEUN.includes(cb[1])) cb[0] = 4354;
      else if (RIEUL_TO_IEUNG.includes(cb[1])) cb[0] = 4363;
      else 두음법칙을_적용했는가 = false;
    } else if (cb[0] == 4354) { // ㄴ에서 ㅇ
      if (NIEUN_TO_IEUNG.includes(cb[1])) {
        cb[0] = 4363;
        두음법칙을_적용했는가 = true;
      }
    }

    if (두음법칙을_적용했는가) {
      cb[0] -= 0x1100; cb[1] -= 0x1161; cb[2] -= 0x11A7;
      return String.fromCharCode(((cb[0] * 21) + cb[1]) * 28 + cb[2] + 0xAC00);
    }
    break;
  }
  case 'ESH': default:
    break;
  }
}

/**
 * 미션 글자를 랜덤하게 고릅니다.
 * @param lang {'ko' | string}
 * @returns {string} 한 글자
 */
function getMission(lang) {
  /**
   * @type {string[]}
   */
  const arr = (lang === 'ko') ? Const.MISSION_ko : Const.MISSION_en;

  if (!arr) return '-';
  return arr[Math.floor(Math.random() * arr.length)];
}

module.exports = class {
  constructor(_DB, _DIC, _ROOM) {
    this.DB = _DB;
    this.DIC = _DIC;
    this.ROOM = _ROOM;
  }

  /**
   * @param char
   * @param subChar
   * @param type {number} 0 무작위 단어 하나, 1 존재 여부, 2 단어 목록
   * @returns {Promise}
   */
  getAuto(char, subChar, type) {
    return new Promise((resolve) => {
      const gameType = Const.GAME_TYPE[this.ROOM.mode];
      const adc = char + (subChar ? ('|' + subChar) : '');
      let adv;

      switch (gameType) {
      case 'EKT':
        adv = `^(${adc})..`;
        break;
      case 'KSH':
        adv = `^(${adc}).`;
        break;
      case 'ESH':
        adv = `^(${adc})...`;
        break;
      case 'KKT':
        adv = `^(${adc}).{${this.ROOM.game.wordLength - 1}}$`;
        break;
      case 'KAP':
        adv = `.(${adc})$`;
        break;
      }

      const key = gameType + '_' + keyByOptions(this.ROOM.opts);
      const mannerTable = this.DB.kkutu_manner[this.ROOM.rule.lang];

      if (!char) {
        console.log(`Undefined char detected! key=${key} type=${type} adc=${adc}`);
      }

      const produce = () => {
        function updateMannerCache(list) {
          function onFail(list) {
            mannerTable.createColumn(key, 'boolean').on(() => {
              updateMannerCache(list);
            });
          }

          mannerTable.upsert(['_id', char]).set([key, list.length ? true : false]).on(null, null, () => { onFail(list); });
        }

        const query = [['_id', new RegExp(adv)]];
        if (!this.ROOM.opts.injeong) query.push(['flag', { $nand: Const.KOR_FLAG.INJEONG }]);
        if (this.ROOM.rule.lang === 'ko') {
          if (this.ROOM.opts.loanword) query.push(['flag', { $nand: Const.KOR_FLAG.LOANWORD }]);
          if (this.ROOM.opts.strict) query.push(['type', Const.KOR_STRICT], ['flag', { $lte: 3 }]);
          else query.push(['type', Const.KOR_GROUP]);
        } else {
          query.push(['_id', Const.ENG_ID]);
        }

        const aft = ($md) => {
          switch (type) {
          case 0:
          default:
            resolve($md[Math.floor(Math.random() * $md.length)]);
            break;
          case 1:
            resolve($md.length ? true : false);
            break;
          case 2:
            resolve($md);
            break;
          }
        };

        this.DB.kkutu[this.ROOM.rule.lang].find(...query).limit(type == 1 ? 1 : 123).on(($md) => {
          updateMannerCache($md);

          if (this.ROOM.game.chain) {
            $md = $md.filter((item) => !this.ROOM.game.chain.includes(item));
          }
          aft($md);
        });
      };

      mannerTable.findOne(['_id', char || '★']).on(($mn) => {
        if ($mn && type === 1 && $mn[key] !== null) {
          resolve($mn[key]);
          return;
        }
        produce();
      });
    });
  }

  getTitle() {
    return new Promise((resolve) => {
      const rule = this.ROOM.rule;

      if (!rule || !rule.lang) {
        resolve('undefinedd');
        return;
      }

      const EXAMPLE = Const.EXAMPLE_TITLE[rule.lang];
      this.ROOM.game.dic = {};

      let eng;

      switch (Const.GAME_TYPE[this.ROOM.mode]) {
      case 'EKT':
      case 'ESH':
        eng = '^' + String.fromCharCode(97 + Math.floor(Math.random() * 26));
        break;
      case 'KKT':
        this.ROOM.game.wordLength = 3;
      case 'KSH': {
        // 가나다라마바사아자차카타파하
        const consonant = 44032 + 588 * Math.floor(Math.random() * 18);
        eng = '^[\\u' + consonant.toString(16) + '-\\u' + (consonant + 587).toString(16) + ']';
        break;
      }
      case 'KAP': {
        // 가나다라마바사아자차카타파하
        const consonant = 44032 + 588 * Math.floor(Math.random() * 18);
        eng = '[\\u' + consonant.toString(16) + '-\\u' + (consonant + 587).toString(16) + ']$';
        break;
      }
      }

      const checkTitle = async (title) => {
        if (title == null) {
          return EXAMPLE;
        }

        /* 부하가 너무 걸린다면 주석을 풀자.
        return true;
        */

        const checkPromises = title.split('').map((char) => this.getAuto(char, getSubChar(char, this.ROOM.mode), 1));
        const checkResult = await Promise.all(checkPromises);
        for (const res of checkResult) {
          if (!res) return EXAMPLE;
        }

        return title;
      };

      const tryTitle = (h) => {
        if (h > 50) {
          resolve(EXAMPLE);
          return;
        }

        const otherCharLength = Math.max(1, this.ROOM.round - 1);
        this.DB.kkutu[rule.lang].find(
          ['_id', new RegExp(`${eng}.{${otherCharLength}}$`)],
          // [ 'hit', { '$lte': h } ],
          (rule.lang === 'ko') ? ['type', Const.KOR_GROUP] : ['_id', Const.ENG_ID]
          // '$where', eng+"this._id.length == " + Math.max(2, my.round) + " && this.hit <= " + h
        ).limit(20).on(($md) => {
          if (!$md.length) {
            tryTitle(h + 10);
            return;
          }

          const list = shuffle($md);
          checkTitle(list.shift()._id).then(onChecked);

          function onChecked(v) {
            if (v) resolve(v);
            else if (!list.length) resolve(EXAMPLE);
            else checkTitle(list.shift()._id).then(onChecked);
          }
        });
      };

      tryTitle(10);
    });
  }

  roundReady() {
    if (!this.ROOM.game.title) return;

    clearTimeout(this.ROOM.game.turnTimer);
    this.ROOM.game.round++;
    this.ROOM.game.roundTime = this.ROOM.time * 1000;
    if (this.ROOM.game.round <= this.ROOM.round) {
      this.ROOM.game.char = this.ROOM.game.title[this.ROOM.game.round - 1];
      this.ROOM.game.subChar = getSubChar(this.ROOM.game.char, this.ROOM.mode);
      this.ROOM.game.chain = [];
      if (this.ROOM.opts.mission) this.ROOM.game.mission = getMission(this.ROOM.rule.lang);
      if (this.ROOM.opts.sami) this.ROOM.game.wordLength = 2;

      this.ROOM.byMaster('roundReady', {
        round: this.ROOM.game.round,
        char: this.ROOM.game.char,
        subChar: this.ROOM.game.subChar,
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
    if (this.ROOM.opts.sami) this.ROOM.game.wordLength = (this.ROOM.game.wordLength == 3) ? 2 : 3;

    this.ROOM.byMaster('turnStart', {
      turn: this.ROOM.game.turn,
      char: this.ROOM.game.char,
      subChar: this.ROOM.game.subChar,
      speed: speed,
      roundTime: this.ROOM.game.roundTime,
      turnTime: this.ROOM.game.turnTime,
      mission: this.ROOM.game.mission,
      wordLength: this.ROOM.game.wordLength,
      seq: force ? this.ROOM.game.seq : undefined
    }, true);
    this.ROOM.game.turnTimer = setTimeout(() => { this.ROOM.turnEnd(); }, Math.min(this.ROOM.game.roundTime, this.ROOM.game.turnTime + 100));
    if (si = this.ROOM.game.seq[this.ROOM.game.turn]) {
      if (si.robot) {
        si._done = [];
        this.ROOM.readyRobot(si);
      }
    }
  }

  turnEnd() {
    var target;
    var score;

    if (!this.ROOM.game.seq) return;
    target = this.DIC[this.ROOM.game.seq[this.ROOM.game.turn]] || this.ROOM.game.seq[this.ROOM.game.turn];

    if (this.ROOM.game.loading) {
      this.ROOM.game.turnTimer = setTimeout(() => { this.ROOM.turnEnd(); }, 100);
      return;
    }
    this.ROOM.game.late = true;
    if (target) {
      if (target.game) {
        score = Const.getPenalty(this.ROOM.game.chain, target.game.score);
        target.game.score += score;
      }
    }

    var my = this;
    this.getAuto(this.ROOM.game.char, this.ROOM.game.subChar, 0).then(function(w) {
      my.ROOM.byMaster('turnEnd', {
        ok: false,
        target: target ? target.id : null,
        score: score,
        hint: w
      }, true);
      my.ROOM.game._rrt = setTimeout(() => { my.ROOM.roundReady(); }, 3000);
    });
    clearTimeout(this.ROOM.game.robotTimer);
  }

  submit(client, text) {
    var score; var l; var t;
    var tv = (new Date()).getTime();
    var mgt = this.ROOM.game.seq[this.ROOM.game.turn];

    if (!mgt) return;
    if (!mgt.robot) if (mgt != client.id) return;
    if (!this.ROOM.game.char) return;

    const my = this;
    if (!isChainable(text, this.ROOM.mode, this.ROOM.game.char, this.ROOM.game.subChar)) return client.chat(text);
    if (this.ROOM.game.chain.indexOf(text) != -1) return client.publish('turnError', { code: 409, value: text }, true);

    l = this.ROOM.rule.lang;
    this.ROOM.game.loading = true;

    function onDB($doc) {
      if (!my.ROOM.game.chain) return;
      var preChar = getChar(text, my.ROOM.mode);
      var preSubChar = getSubChar(preChar, my.ROOM.mode);
      var firstMove = my.ROOM.game.chain.length < 1;

      function preApproved() {
        function approved() {
          if (my.ROOM.game.late) return;
          if (!my.ROOM.game.chain) return;
          if (!my.ROOM.game.dic) return;

          my.ROOM.game.loading = false;
          my.ROOM.game.late = true;
          clearTimeout(my.ROOM.game.turnTimer);
          t = tv - my.ROOM.game.turnAt;
          score = my.ROOM.getScore(text, t);
          my.ROOM.game.dic[text] = (my.ROOM.game.dic[text] || 0) + 1;
          my.ROOM.game.chain.push(text);
          my.ROOM.game.roundTime -= t;
          my.ROOM.game.char = preChar;
          my.ROOM.game.subChar = preSubChar;
          client.game.score += score;
          client.publish('turnEnd', {
            ok: true,
            value: text,
            mean: $doc.mean,
            theme: $doc.theme,
            wc: $doc.type,
            score: score,
            bonus: (my.ROOM.game.mission === true) ? score - my.ROOM.getScore(text, t, true) : 0,
            baby: $doc.baby
          }, true);
          if (my.ROOM.game.mission === true) {
            my.ROOM.game.mission = getMission(my.ROOM.rule.lang);
          }
          setTimeout(() => { my.ROOM.turnNext(); }, my.ROOM.game.turnTime / 6);
          if (!client.robot) {
            client.invokeWordPiece(text, 1);
            my.DB.kkutu[l].update(['_id', text]).set(['hit', $doc.hit + 1]).on();
          }
        }
        if (firstMove || my.ROOM.opts.manner) {
          my.getAuto(preChar, preSubChar, 1).then(function(w) {
            if (w) approved();
            else {
              my.ROOM.game.loading = false;
              client.publish('turnError', { code: firstMove ? 402 : 403, value: text }, true);
              if (client.robot) {
                my.ROOM.readyRobot(client);
              }
            }
          });
        } else approved();
      }
      function denied(code) {
        my.ROOM.game.loading = false;
        client.publish('turnError', { code: code || 404, value: text }, true);
      }
      if ($doc) {
        if (!my.ROOM.opts.injeong && ($doc.flag & Const.KOR_FLAG.INJEONG)) denied();
        else if (my.ROOM.opts.strict && (!$doc.type.match(Const.KOR_STRICT) || $doc.flag >= 4)) denied(406);
        else if (my.ROOM.opts.loanword && ($doc.flag & Const.KOR_FLAG.LOANWORD)) denied(405);
        else preApproved();
      } else {
        denied();
      }
    }
    function isChainable() {
      var type = Const.GAME_TYPE[my.ROOM.mode];
      var char = my.ROOM.game.char; var subChar = my.ROOM.game.subChar;
      var l = char.length;

      if (!text) return false;
      if (text.length <= l) return false;
      if (my.ROOM.game.wordLength && text.length != my.ROOM.game.wordLength) return false;
      if (type == 'KAP') return (text.slice(-1) == char) || (text.slice(-1) == subChar);
      switch (l) {
      case 1: return (text[0] == char) || (text[0] == subChar);
      case 2: return (text.substr(0, 2) == char);
      case 3: return (text.substr(0, 3) == char) || (text.substr(0, 2) == char.slice(1));
      default: return false;
      }
    }
    my.DB.kkutu[l].findOne(['_id', text],
      (l == 'ko') ? ['type', Const.KOR_GROUP] : ['_id', Const.ENG_ID]
    ).on(onDB);
  }

  getScore(text, delay, ignoreMission) {
    var tr = 1 - delay / this.ROOM.game.turnTime;
    var score; var arr;

    if (!text || !this.ROOM.game.chain || !this.ROOM.game.dic) return 0;
    score = Const.getPreScore(text, this.ROOM.game.chain, tr);

    if (this.ROOM.game.dic[text]) score *= 15 / (this.ROOM.game.dic[text] + 15);
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
    var ended = {};
    var w; var text; var i;
    var lmax;
    var isRev = Const.GAME_TYPE[this.ROOM.mode] == 'KAP';

    var my = this;

    this.getAuto(this.ROOM.game.char, this.ROOM.game.subChar, 2).then(function(list) {
      if (list.length) {
        list.sort(function(a, b) { return b.hit - a.hit; });
        if (ROBOT_HIT_LIMIT[level] > list[0].hit) denied();
        else {
          if (level >= 3 && !robot._done.length) {
            if (Math.random() < 0.5) list.sort(function(a, b) { return b._id.length - a._id.length; });
            if (list[0]._id.length < 8 && my.ROOM.game.turnTime >= 2300) {
              for (i in list) {
                w = list[i]._id.charAt(isRev ? 0 : (list[i]._id.length - 1));
                if (!ended.hasOwnProperty(w)) ended[w] = [];
                ended[w].push(list[i]);
              }
              getWishList(Object.keys(ended)).then(function(key) {
                var v = ended[key];

                if (!v) denied();
                else pickList(v);
              });
            } else {
              pickList(list);
            }
          } else pickList(list);
        }
      } else denied();
    });
    function denied() {
      text = isRev ? `T.T ...${my.ROOM.game.char}` : `${my.ROOM.game.char}... T.T`;
      after();
    }
    function pickList(list) {
      if (list) {
        do {
          if (!(w = list.shift())) break;
        } while (w._id.length > ROBOT_LENGTH_LIMIT[level] || robot._done.includes(w._id));
      }
      if (w) {
        text = w._id;
        delay += 500 * ROBOT_THINK_COEF[level] * Math.random() / Math.log(1.1 + w.hit);
        after();
      } else denied();
    }
    function after() {
      delay += text.length * ROBOT_TYPE_COEF[level];
      robot._done.push(text);
      setTimeout(() => { my.ROOM.turnRobot(robot, text); }, delay);
    }
    async function getWishList(list) {
      const wishPromises = list.map((item) => getWish(item));
      const result = await Promise.all(wishPromises);

      if (!my.ROOM.game.chain) return;

      result.sort((a, b) => a.length - b.length);

      let res = result.shift();
      if (my.ROOM.opts.manner || !my.ROOM.game.chain.length) {
        while (res) {
          if (res.length) break;
          res = result.shift();
        }
      }
      return res ? res.char : null;
    }
    function getWish(char) {
      return new Promise((resolve) => {
        my.DB.kkutu[my.ROOM.rule.lang]
          .find(['_id', new RegExp(isRev ? `.${char}$` : `^${char}.`)])
          .limit(10).on(($res) => {
            resolve({ char: char, length: $res.length });
          });
      });
    }
  }
};