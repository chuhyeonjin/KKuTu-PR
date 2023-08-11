const Cluster = require('cluster');
const Const = require('kkutu-common/const');
const JLog = require('kkutu-common/jjlog');
const Robot = require('./robot');

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

/**
 * @param mode {number} 게임 모드 (숫자로 주어짐)
 * @param score {number} 내가 얻은 점수
 * @param bonus {number}
 * @param rank {number} 게임에서 나의 점수 순위 (0 ~ 7)
 * @param all {number} 전체 플레이어 명수 (1 ~ 8)
 * @param sumOfScore {number} 한 게임의 플레이어들의 점수의 합
 * @returns {{score: number, money: number, together?: boolean}}
 */
function getRewards(mode, score, bonus, rank, all, sumOfScore) {
  const scoreMultiplier = {
    EKT: 1.4,
    ESH: 0.5,
    KKT: 1.42,
    KSH: 0.55,
    CSQ: 0.4,
    KCW: 1.0,
    KTY: 0.3,
    ETY: 0.37,
    KAP: 0.8,
    HUN: 0.5,
    KDA: 0.57,
    EDA: 0.65,
    KSS: 0.5,
    ESS: 0.22
  };

  const reward = { score: 0, money: 0 };

  const gameModeName = Const.GAME_TYPE[mode];
  if (scoreMultiplier[gameModeName]) {
    reward.score += score * scoreMultiplier[gameModeName];
  }

  const scoreRatio = score / sumOfScore;
  reward.score = reward.score *
    (0.77 + 0.05 * (all - rank) * (all - rank)) * // 순위
    1.25 / (1 + 1.25 * scoreRatio * scoreRatio) // 점차비(양학했을 수록 ↓)
  ;
  reward.money = 1 + reward.score * 0.01;
  if (all < 2) {
    reward.score = reward.score * 0.05;
    reward.money = reward.money * 0.05;
  } else {
    reward.together = true;
  }
  reward.score += bonus;
  reward.score = reward.score || 0;
  reward.money = reward.money || 0;

  // applyEquipOptions에서 반올림한다.
  return reward;
}

function filterRobot(item) {
  if (!item) return {};
  return (item.robot && item.getData) ? item.getData() : item;
}

class Room {
  constructor(room, channel, _rid, DIC, ROOM, DB, publish) {
    this.DIC = DIC;
    this.ROOM = ROOM;
    this.DB = DB;
    this.publish = publish;

    this.id = room.id || _rid;
    this.channel = channel;
    this.opts = {};
    /*my.title = room.title;
      my.password = room.password;
      my.limit = Math.round(room.limit);
      my.mode = room.mode;
      my.rule = Const.getRule(room.mode);
      my.round = Math.round(room.round);
      my.time = room.time * my.rule.time;
      my.opts = {
          manner: room.opts.manner,
          extend: room.opts.injeong,
          mission: room.opts.mission,
          loanword: room.opts.loanword,
          injpick: room.opts.injpick || []
      };*/
    this.master = null;
    this.tail = [];
    this.players = [];
    this.kicked = [];
    this.kickVote = null;
  
    this.gaming = false;
    this.game = {};
  
    this.set(room);
  }

  getData() {
    const readies = {};
    const players = [];
    for (const player of this.players) {
      const o = this.DIC[player];
      if (o) {
        readies[player] = {
          r: o.ready || o.game.ready,
          f: o.form || o.game.form,
          t: o.team || o.game.team
        };
      }
      players.push(filterRobot(player));
    }

    const seq = this.game.seq ? this.game.seq.map(filterRobot) : [];

    return {
      id: this.id,
      channel: this.channel,
      title: this.title,
      password: this.password ? true : false,
      limit: this.limit,
      mode: this.mode,
      round: this.round,
      time: this.time,
      master: this.master,
      players: players,
      readies: readies,
      gaming: this.gaming,
      game: {
        round: this.game.round,
        turn: this.game.turn,
        seq: seq,
        title: this.game.title,
        mission: this.game.mission
      },
      practice: this.practice ? true : false,
      opts: this.opts
    };
  }

  addAI(caller) {
    if (this.players.length >= this.limit) return caller.sendError(429);

    if (this.gaming) return caller.send('error', { code: 416, target: this.id });

    if (!this.rule.ai) return caller.sendError(415);

    this.players.push(new Robot(null, this.id, 2, this.DIC));
    this.export();
  }

  setAI(target, level, team) {
    for (const player of this.players) {
      if (!player) continue;
      if (!player.robot) continue;

      if (player.id == target) {
        player.setLevel(level);
        player.setTeam(team);
        this.export();
        return true;
      }
    }
    return false;
  }

  /**
   *
   * @param target {string | any} fasly 하면 AI이기만 하면 삭제
   * @param noEx {boolean} this.export 실행 여부
   * @returns {boolean} 성공 여부
   */
  removeAI(target, noEx) {
    for (const i in this.players) {
      if (!this.players[i]) continue;
      if (!this.players[i].robot) continue;

      if (!target || this.players[i].id == target) {
        if (this.gaming) {
          const j = this.game.seq.indexOf(this.players[i]);
          if (j != -1) this.game.seq.splice(j, 1);
        }
        this.players.splice(i, 1);
        if (!noEx) this.export();
        return true;
      }
    }

    return false;
  }

  come(client) {
    if (!this.practice) client.place = this.id;

    if (this.players.push(client.id) == 1) {
      this.master = client.id;
    }

    if (Cluster.isWorker) {
      client.ready = false;
      client.team = 0;
      client.cameWhenGaming = false;
      client.form = 'J';

      if (!this.practice) process.send({ type: 'room-come', target: client.id, id: this.id });
      this.export(client.id);
    }
  }

  spectate(client, password) {
    if (!this.practice) client.place = this.id;

    this.players.push(client.id);

    if (Cluster.isWorker) {
      client.ready = false;
      client.team = 0;
      client.cameWhenGaming = true;
      client.form = (this.players.length > this.limit) ? 'O' : 'S';

      process.send({ type: 'room-spectate', target: client.id, id: this.id, pw: password });
      this.export(client.id, false, true);
    }
  }

  /**
   * 플레이어 퇴장
   *
   * @param client
   * @param kickVote
   * @returns {*}
   */
  go(client, kickVote) {
    if (!this.players.includes(client.id)) {
      client.place = 0;
      if (this.players.length < 1) delete this.ROOM[this.id];
      return client.sendError(409);
    }

    this.players.splice(this.players.indexOf(client.id), 1);
    client.game = {};

    if (client.id == this.master) {
      while (this.removeAI(false, true));
      this.master = this.players[0];
    }

    if (this.DIC[this.master]) {
      this.DIC[this.master].ready = false;

      if (this.gaming) {
        const x = this.game.seq.indexOf(client.id);
        if (x != -1) {
          if (this.game.seq.length <= 2) {
            this.game.seq.splice(x, 1);
            this.roundEnd();
          } else {
            const me = this.game.turn == x;
            if (me && this.rule.ewq) {
              clearTimeout(this.game._rrt);
              this.game.loading = false;
              if (Cluster.isWorker) this.turnEnd();
            }
            this.game.seq.splice(x, 1);
            if (this.game.turn > x) {
              this.game.turn--;
              if (this.game.turn < 0) this.game.turn = this.game.seq.length - 1;
            }
            if (this.game.turn >= this.game.seq.length) this.game.turn = 0;
          }
        }
      }
    } else {
      if (this.gaming) {
        this.interrupt();
        this.game.late = true;
        this.gaming = false;
        this.game = {};
      }
      delete this.ROOM[this.id];
    }

    if (this.practice) {
      clearTimeout(this.game.turnTimer);
      client.subPlace = 0;
    } else client.place = 0;

    if (Cluster.isWorker) {
      if (!this.practice) {
        client.socket.close();
        process.send({ type: 'room-go', target: client.id, id: this.id, removed: !this.ROOM.hasOwnProperty(this.id) });
      }
      this.export(client.id, kickVote);
    }
  }
  set(room) {
    this.title = room.title;
    this.password = room.password;
    this.limit = Math.max(Math.min(8, this.players.length), Math.round(room.limit));
    this.mode = room.mode;
    this.rule = Const.getRule(room.mode);
    this.round = Math.round(room.round);
    this.time = room.time * this.rule.time;

    if (room.opts && this.opts) {
      for (const optionKey in Const.OPTIONS) {
        const optionName = Const.OPTIONS[optionKey].name.toLowerCase();
        this.opts[optionName] = room.opts[optionName] && this.rule.opts.includes(optionKey);
      }

      // ijp 옵션은 어인정 주제선택이 가능함을 나타냄
      const isInjPickable = this.rule.opts.includes('ijp');
      if (isInjPickable) {
        const injPickAllowList = Const[`${this.rule.lang.toUpperCase()}_IJP`];
        this.opts.injpick = (room.opts.injpick || []).filter((item) => injPickAllowList.includes(item));
      } else this.opts.injpick = [];
    }

    if (!this.rule.ai) {
      while (this.removeAI(false, true));
    }

    for (const player of this.players) {
      if (this.DIC[player]) this.DIC[player].ready = false;
    }

    if (!this.rule) {
      JLog.warn('Unknown mode: ' + this.mode);
      return;
    }

    const implementation = require(`../games/${this.rule.rule.toLowerCase()}`);
    this.gameImplementation = new implementation(this.DB, this.DIC, this);
  }

  preReady(teams) {
    // 팀 검사
    if (teams) {
      if (teams[0].length) {
        if (teams[1].length > 1 || teams[2].length > 1 || teams[3].length > 1 || teams[4].length > 1) return 418;
      } else {
        let otherTeamSize = 0;
        const availableTeam = [];

        for (let i = 1; i < 5; i++) {
          const currentTeamSize = teams[i].length;
          if (!currentTeamSize) continue;

          if (otherTeamSize) {
            if (otherTeamSize !== currentTeamSize) return 418;
          } else otherTeamSize = currentTeamSize;

          availableTeam.push(i);
        }
        if (availableTeam.length < 2) return 418;
        this._avTeam = shuffle(availableTeam);
      }
    }

    // 인정픽 검사
    if (!this.rule) return 400;
    if (this.rule.opts.includes('ijp')) {
      if (!this.opts.injpick) return 400;
      if (!this.opts.injpick.length) return 413;
      if (!this.opts.injpick.every((item) => {
        return !Const.IJP_EXCEPT.includes(item);
      })) return 414;
    }

    return false;
  }

  ready() {
    let isAllReady = true;
    let numberOfPlayer = 0;
    const teams = [[], [], [], [], []];

    for (const player of this.players) {
      if (player.robot) {
        numberOfPlayer++;
        teams[player.game.team].push(player);
        continue;
      }

      if (!this.DIC[player]) continue;
      if (this.DIC[player].form == 'S') continue;

      numberOfPlayer++;
      teams[this.DIC[player].team].push(player);

      if (player === this.master) continue;

      if (!this.DIC[player].ready) {
        isAllReady = false;
        break;
      }
    }

    if (!this.DIC[this.master]) return;
    if (numberOfPlayer < 2) return this.DIC[this.master].sendError(411);

    const preReadyResult = this.preReady(teams);
    if (preReadyResult) return this.DIC[this.master].sendError(preReadyResult);
    if (!isAllReady) return this.DIC[this.master].sendError(412);

    this._teams = teams;
    this.start();
  }

  start(pracLevel) {
    const now = Date.now();

    this.gaming = true;
    this.game.late = true;
    this.game.round = 0;
    this.game.turn = 0;
    this.game.seq = [];
    this.game.robots = [];

    let NumberOfHumanPlayer = 0;

    if (this.practice) {
      const robot = new Robot(this.master, this.id, pracLevel, this.DIC);
      this.game.robots.push(robot);
      this.game.seq.push(robot, this.master);
    } else {
      for (const player of this.players) {
        if (player.robot) {
          this.game.robots.push(player);
        } else {
          const o = this.DIC[player];
          if (!o) continue;
          if (o.form != 'J') continue;
          NumberOfHumanPlayer++;
        }
        if (player) this.game.seq.push(player);
      }

      if (this._avTeam) {
        const numberOfPlayers = this.game.seq.length;
        const numberOfTeams = this._avTeam.length;
        this.game.seq = [];
        for (let i = 0; i < numberOfPlayers; i++) {
          const v = this._teams[this._avTeam[i % numberOfTeams]].shift();
          if (!v) continue;
          this.game.seq[i] = v;
        }
      } else {
        this.game.seq = shuffle(this.game.seq);
      }
    }

    this.game.mission = null;
    for (const player of this.game.seq) {
      const o = this.DIC[player] || player;
      if (!o) continue;
      if (!o.game) continue;

      o.playAt = now;
      o.ready = false;
      o.game.score = 0;
      o.game.bonus = 0;
      o.game.item = [/*0, 0, 0, 0, 0, 0*/];
      o.game.wpc = [];
    }
    this.game.hum = NumberOfHumanPlayer;
    this.getTitle().then((title) => {
      this.game.title = title;
      this.export();
      setTimeout(() => { this.roundReady(); }, 2000);
    });
    this.byMaster('starting', { target: this.id });
    delete this._avTeam;
    delete this._teams;
  }

  roundReady() {
    if (!this.gaming) return;
    return this.route('roundReady');
  }

  interrupt() {
    clearTimeout(this.game._rrt);
    clearTimeout(this.game.turnTimer);
    clearTimeout(this.game.hintTimer);
    clearTimeout(this.game.hintTimer2);
    clearTimeout(this.game.qTimer);
  }

  roundEnd(data) {
    const now = Date.now();

    this.interrupt();
    for (const player of this.players) {
      const o = this.DIC[player];
      if (!o) continue;
      if (o.cameWhenGaming) {
        o.cameWhenGaming = false;
        if (o.form == 'O') {
          o.sendError(428);
          o.leave();
          continue;
        }
        o.setForm('J');
      }
    }

    const teams = [null, [], [], [], []];

    for (const player of this.game.seq) {
      const o = this.DIC[player] || player;
      if (!o) continue;

      if (o.robot && o.game.team) teams[o.game.team].push(o.game.score);
      if (!o.robot && o.team) teams[o.team].push(o.game.score);
    }

    for (let i = 1; i <= 4; i++) {
      const teamSize = teams[i].length;
      if (teamSize) teams[i] = [teamSize, teams[i].reduce((p, item) => p + item, 0)];
    }

    const res = [];
    let sumScore = 0;

    for (const player of this.game.seq) {
      const o = this.DIC[player];
      if (!o) continue;
      sumScore += o.game.score;
      res.push({ id: o.id, score: o.team ? teams[o.team][1] : o.game.score, dim: o.team ? teams[o.team][0] : 1 });
    }

    res.sort((a, b) => b.score - a.score);
    const resLength = res.length;

    const users = {};
    const suv = [];
    let previous = -1;

    for (const i in res) {
      const o = this.DIC[res[i].id];

      if (previous === res[i].score) {
        res[i].rank = res[Number(i) - 1].rank;
      } else {
        res[i].rank = Number(i);
      }
      previous = res[i].score;

      const rewards = getRewards(this.mode, o.game.score / res[i].dim, o.game.bonus, res[i].rank, resLength, sumScore);
      rewards.playTime = now - o.playAt;
      o.applyEquipOptions(rewards); // 착용 아이템 보너스 적용
      if (rewards.together) {
        if (o.game.wpc) o.game.wpc.forEach((item) => o.obtain('$WPC' + item, 1)); // 글자 조각 획득 처리
        o.onOKG(rewards.playTime);
      }
      res[i].reward = rewards;
      o.data.score += rewards.score || 0;
      o.money += rewards.money || 0;
      o.data.record[Const.GAME_TYPE[this.mode]][2] += rewards.score || 0;
      o.data.record[Const.GAME_TYPE[this.mode]][3] += rewards.playTime;
      if (!this.practice && rewards.together) {
        o.data.record[Const.GAME_TYPE[this.mode]][0]++;
        if (res[i].rank == 0) o.data.record[Const.GAME_TYPE[this.mode]][1]++;
      }
      users[o.id] = o.getData();

      suv.push(o.flush(true));
    }

    Promise.all(suv).then((uds) => {
      const o = {};
      const suv = [];

      for (const i in uds) {
        o[uds[i].id] = { prev: uds[i].prev };
        suv.push(this.DB.redis.getSurround(uds[i].id));
      }

      Promise.all(suv).then((ranks) => {
        for (const i in ranks) {
          if (!o[ranks[i].target]) continue;

          o[ranks[i].target].list = ranks[i].data;
        }
        this.byMaster('roundEnd', { result: res, users: users, ranks: o, data: data }, true);
      });
    });
    this.gaming = false;
    this.export();
    delete this.game.seq;
    delete this.game.wordLength;
    delete this.game.dic;
  }

  byMaster(type, data, nob) {
    if (this.DIC[this.master]) this.DIC[this.master].publish(type, data, nob);
  }

  export(target, kickVote, spec) {
    const obj = { room: this.getData() };

    if (!this.rule) return;

    if (target) obj.target = target;
    if (kickVote) obj.kickVote = kickVote;

    if (spec && this.gaming) {
      if (this.rule.rule == 'Classic') {
        if (this.game.chain) obj.chain = this.game.chain.length;
      } else if (this.rule.rule == 'Jaqwi') {
        obj.theme = this.game.theme;
        obj.conso = this.game.conso;
      } else if (this.rule.rule == 'Crossword') {
        obj.prisoners = this.game.prisoners;
        obj.boards = this.game.boards;
        obj.means = this.game.means;
      }

      obj.spec = {};
      for (const player of this.game.seq) {
        const o = this.DIC[player];
        if (o) obj.spec[o.id] = o.game.score;
      }
    }

    if (this.practice) {
      if (this.DIC[this.master || target]) this.DIC[this.master || target].send('room', obj);
    } else {
      this.publish('room', obj, this.password);
    }
  }

  turnStart(force) {
    if (!this.gaming) return;
    return this.route('turnStart', force);
  }

  readyRobot(robot) {
    if (!this.gaming) return;
    return this.route('readyRobot', robot);
  }

  turnRobot(robot, text, data) {
    if (!this.gaming) return;
    this.submit(robot, text, data);
    //return this.route("turnRobot", robot, text);
  }

  turnNext(force) {
    if (!this.gaming) return;
    if (!this.game.seq) return;

    this.game.turn = (this.game.turn + 1) % this.game.seq.length;
    this.turnStart(force);
  }

  turnEnd() {
    return this.route('turnEnd');
  }

  submit(client, text, data) {
    return this.route('submit', client, text, data);
  }

  getScore(text, delay, ignoreMission) {
    return this.route('getScore', text, delay, ignoreMission);
  }

  getTurnSpeed(rt) {
    if (rt < 5000) return 10;
    else if (rt < 11000) return 9;
    else if (rt < 18000) return 8;
    else if (rt < 26000) return 7;
    else if (rt < 35000) return 6;
    else if (rt < 45000) return 5;
    else if (rt < 56000) return 4;
    else if (rt < 68000) return 3;
    else if (rt < 81000) return 2;
    else if (rt < 95000) return 1;
    else return 0;
  }

  getTitle() {
    return this.route('getTitle');
  }

  route(func, ...args) {
    if (!this.gameImplementation) return JLog.warn('Unknown rule: ' + this.rule.rule);
    if (!this.gameImplementation[func]) return JLog.warn('Unknown function: ' + func);
    return this.gameImplementation[func](...args);
  }
}

module.exports = Room;