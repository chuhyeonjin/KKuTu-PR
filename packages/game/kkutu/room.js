const Cluster = require('cluster');
const Const = require('kkutu-common/const');
const JLog = require('kkutu-common/jjlog');
const Lizard = require('kkutu-common/lizard');
const Robot = require('./robot');

function shuffle(arr) {
  var i; var r = [];

  for (i in arr) r.push(arr[i]);
  r.sort(function(a, b) { return Math.random() - 0.5; });

  return r;
}
function getRewards(mode, score, bonus, rank, all, ss) {
  var rw = { score: 0, money: 0 };
  var sr = score / ss;

  // all은 1~8
  // rank는 0~7
  switch (Const.GAME_TYPE[mode]) {
  case 'EKT':
    rw.score += score * 1.4;
    break;
  case 'ESH':
    rw.score += score * 0.5;
    break;
  case 'KKT':
    rw.score += score * 1.42;
    break;
  case 'KSH':
    rw.score += score * 0.55;
    break;
  case 'CSQ':
    rw.score += score * 0.4;
    break;
  case 'KCW':
    rw.score += score * 1.0;
    break;
  case 'KTY':
    rw.score += score * 0.3;
    break;
  case 'ETY':
    rw.score += score * 0.37;
    break;
  case 'KAP':
    rw.score += score * 0.8;
    break;
  case 'HUN':
    rw.score += score * 0.5;
    break;
  case 'KDA':
    rw.score += score * 0.57;
    break;
  case 'EDA':
    rw.score += score * 0.65;
    break;
  case 'KSS':
    rw.score += score * 0.5;
    break;
  case 'ESS':
    rw.score += score * 0.22;
    break;
  default:
    break;
  }
  rw.score = rw.score *
    (0.77 + 0.05 * (all - rank) * (all - rank)) * // 순위
    1.25 / (1 + 1.25 * sr * sr) // 점차비(양학했을 수록 ↓)
  ;
  rw.money = 1 + rw.score * 0.01;
  if (all < 2) {
    rw.score = rw.score * 0.05;
    rw.money = rw.money * 0.05;
  } else {
    rw.together = true;
  }
  rw.score += bonus;
  rw.score = rw.score || 0;
  rw.money = rw.money || 0;

  // applyEquipOptions에서 반올림한다.
  return rw;
}
function filterRobot(item) {
  if (!item) return {};
  return (item.robot && item.getData) ? item.getData() : item;
}

const Room = function(room, channel, _rid, DIC, ROOM, DB, publish) {
  var my = this;

  my.id = room.id || _rid;
  my.channel = channel;
  my.opts = {};
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
  my.master = null;
  my.tail = [];
  my.players = [];
  my.kicked = [];
  my.kickVote = null;

  my.gaming = false;
  my.game = {};

  my.getData = function() {
    var i; var readies = {};
    var pls = [];
    var seq = my.game.seq ? my.game.seq.map(filterRobot) : [];
    var o;

    for (i in my.players) {
      if (o = DIC[my.players[i]]) {
        readies[my.players[i]] = {
          r: o.ready || o.game.ready,
          f: o.form || o.game.form,
          t: o.team || o.game.team
        };
      }
      pls.push(filterRobot(my.players[i]));
    }
    return {
      id: my.id,
      channel: my.channel,
      title: my.title,
      password: my.password ? true : false,
      limit: my.limit,
      mode: my.mode,
      round: my.round,
      time: my.time,
      master: my.master,
      players: pls,
      readies: readies,
      gaming: my.gaming,
      game: {
        round: my.game.round,
        turn: my.game.turn,
        seq: seq,
        title: my.game.title,
        mission: my.game.mission
      },
      practice: my.practice ? true : false,
      opts: my.opts
    };
  };
  my.addAI = function(caller) {
    if (my.players.length >= my.limit) {
      return caller.sendError(429);
    }
    if (my.gaming) {
      return caller.send('error', { code: 416, target: my.id });
    }
    if (!my.rule.ai) {
      return caller.sendError(415);
    }
    my.players.push(new Robot(null, my.id, 2, DIC));
    my.export();
  };
  my.setAI = function(target, level, team) {
    var i;

    for (i in my.players) {
      if (!my.players[i]) continue;
      if (!my.players[i].robot) continue;
      if (my.players[i].id == target) {
        my.players[i].setLevel(level);
        my.players[i].setTeam(team);
        my.export();
        return true;
      }
    }
    return false;
  };
  my.removeAI = function(target, noEx) {
    var i; var j;

    for (i in my.players) {
      if (!my.players[i]) continue;
      if (!my.players[i].robot) continue;
      if (!target || my.players[i].id == target) {
        if (my.gaming) {
          j = my.game.seq.indexOf(my.players[i]);
          if (j != -1) my.game.seq.splice(j, 1);
        }
        my.players.splice(i, 1);
        if (!noEx) my.export();
        return true;
      }
    }
    return false;
  };
  my.come = function(client) {
    if (!my.practice) client.place = my.id;

    if (my.players.push(client.id) == 1) {
      my.master = client.id;
    }
    if (Cluster.isWorker) {
      client.ready = false;
      client.team = 0;
      client.cameWhenGaming = false;
      client.form = 'J';

      if (!my.practice) process.send({ type: 'room-come', target: client.id, id: my.id });
      my.export(client.id);
    }
  };
  my.spectate = function(client, password) {
    if (!my.practice) client.place = my.id;
    var len = my.players.push(client.id);

    if (Cluster.isWorker) {
      client.ready = false;
      client.team = 0;
      client.cameWhenGaming = true;
      client.form = (len > my.limit) ? 'O' : 'S';

      process.send({ type: 'room-spectate', target: client.id, id: my.id, pw: password });
      my.export(client.id, false, true);
    }
  };
  my.go = function(client, kickVote) {
    var x = my.players.indexOf(client.id);
    var me;

    if (x == -1) {
      client.place = 0;
      if (my.players.length < 1) delete ROOM[my.id];
      return client.sendError(409);
    }
    my.players.splice(x, 1);
    client.game = {};
    if (client.id == my.master) {
      while (my.removeAI(false, true));
      my.master = my.players[0];
    }
    if (DIC[my.master]) {
      DIC[my.master].ready = false;
      if (my.gaming) {
        x = my.game.seq.indexOf(client.id);
        if (x != -1) {
          if (my.game.seq.length <= 2) {
            my.game.seq.splice(x, 1);
            my.roundEnd();
          } else {
            me = my.game.turn == x;
            if (me && my.rule.ewq) {
              clearTimeout(my.game._rrt);
              my.game.loading = false;
              if (Cluster.isWorker) my.turnEnd();
            }
            my.game.seq.splice(x, 1);
            if (my.game.turn > x) {
              my.game.turn--;
              if (my.game.turn < 0) my.game.turn = my.game.seq.length - 1;
            }
            if (my.game.turn >= my.game.seq.length) my.game.turn = 0;
          }
        }
      }
    } else {
      if (my.gaming) {
        my.interrupt();
        my.game.late = true;
        my.gaming = false;
        my.game = {};
      }
      delete ROOM[my.id];
    }
    if (my.practice) {
      clearTimeout(my.game.turnTimer);
      client.subPlace = 0;
    } else client.place = 0;

    if (Cluster.isWorker) {
      if (!my.practice) {
        client.socket.close();
        process.send({ type: 'room-go', target: client.id, id: my.id, removed: !ROOM.hasOwnProperty(my.id) });
      }
      my.export(client.id, kickVote);
    }
  };
  my.set = function(room) {
    var i; var k; var ijc; var ij;

    my.title = room.title;
    my.password = room.password;
    my.limit = Math.max(Math.min(8, my.players.length), Math.round(room.limit));
    my.mode = room.mode;
    my.rule = Const.getRule(room.mode);
    my.round = Math.round(room.round);
    my.time = room.time * my.rule.time;
    if (room.opts && my.opts) {
      for (i in Const.OPTIONS) {
        k = Const.OPTIONS[i].name.toLowerCase();
        my.opts[k] = room.opts[k] && my.rule.opts.includes(i);
      }
      if (ijc = my.rule.opts.includes('ijp')) {
        ij = Const[`${my.rule.lang.toUpperCase()}_IJP`];
        my.opts.injpick = (room.opts.injpick || []).filter(function(item) { return ij.includes(item); });
      } else my.opts.injpick = [];
    }
    if (!my.rule.ai) {
      while (my.removeAI(false, true));
    }
    for (i in my.players) {
      if (DIC[my.players[i]]) DIC[my.players[i]].ready = false;
    }

    if (!my.rule) {
      JLog.warn('Unknown mode: ' + my.mode);
      return;
    }
    const implementation = require(`../games/${my.rule.rule.toLowerCase()}`);
    my.gameImplementation = new implementation(DB, DIC, my);
  };
  my.preReady = function(teams) {
    var i; var j; var t = 0; var l = 0;
    var avTeam = [];

    // 팀 검사
    if (teams) {
      if (teams[0].length) {
        if (teams[1].length > 1 || teams[2].length > 1 || teams[3].length > 1 || teams[4].length > 1) return 418;
      } else {
        for (i = 1; i < 5; i++) {
          if (j = teams[i].length) {
            if (t) {
              if (t != j) return 418;
            } else t = j;
            l++;
            avTeam.push(i);
          }
        }
        if (l < 2) return 418;
        my._avTeam = shuffle(avTeam);
      }
    }
    // 인정픽 검사
    if (!my.rule) return 400;
    if (my.rule.opts.includes('ijp')) {
      if (!my.opts.injpick) return 400;
      if (!my.opts.injpick.length) return 413;
      if (!my.opts.injpick.every(function(item) {
        return !Const.IJP_EXCEPT.includes(item);
      })) return 414;
    }
    return false;
  };
  my.ready = function() {
    var i; var all = true;
    var len = 0;
    var teams = [[], [], [], [], []];

    for (i in my.players) {
      if (my.players[i].robot) {
        len++;
        teams[my.players[i].game.team].push(my.players[i]);
        continue;
      }
      if (!DIC[my.players[i]]) continue;
      if (DIC[my.players[i]].form == 'S') continue;

      len++;
      teams[DIC[my.players[i]].team].push(my.players[i]);

      if (my.players[i] == my.master) continue;
      if (!DIC[my.players[i]].ready) {
        all = false;
        break;
      }
    }
    if (!DIC[my.master]) return;
    if (len < 2) return DIC[my.master].sendError(411);
    if (i = my.preReady(teams)) return DIC[my.master].sendError(i);
    if (all) {
      my._teams = teams;
      my.start();
    } else DIC[my.master].sendError(412);
  };
  my.start = function(pracLevel) {
    var i; var j; var o; var hum = 0;
    var now = (new Date()).getTime();

    my.gaming = true;
    my.game.late = true;
    my.game.round = 0;
    my.game.turn = 0;
    my.game.seq = [];
    my.game.robots = [];
    if (my.practice) {
      my.game.robots.push(o = new Robot(my.master, my.id, pracLevel, DIC));
      my.game.seq.push(o, my.master);
    } else {
      for (i in my.players) {
        if (my.players[i].robot) {
          my.game.robots.push(my.players[i]);
        } else {
          if (!(o = DIC[my.players[i]])) continue;
          if (o.form != 'J') continue;
          hum++;
        }
        if (my.players[i]) my.game.seq.push(my.players[i]);
      }
      if (my._avTeam) {
        o = my.game.seq.length;
        j = my._avTeam.length;
        my.game.seq = [];
        for (i = 0; i < o; i++) {
          var v = my._teams[my._avTeam[i % j]].shift();

          if (!v) continue;
          my.game.seq[i] = v;
        }
      } else {
        my.game.seq = shuffle(my.game.seq);
      }
    }
    my.game.mission = null;
    for (i in my.game.seq) {
      o = DIC[my.game.seq[i]] || my.game.seq[i];
      if (!o) continue;
      if (!o.game) continue;

      o.playAt = now;
      o.ready = false;
      o.game.score = 0;
      o.game.bonus = 0;
      o.game.item = [/*0, 0, 0, 0, 0, 0*/];
      o.game.wpc = [];
    }
    my.game.hum = hum;
    my.getTitle().then(function(title) {
      my.game.title = title;
      my.export();
      setTimeout(my.roundReady, 2000);
    });
    my.byMaster('starting', { target: my.id });
    delete my._avTeam;
    delete my._teams;
  };
  my.roundReady = function() {
    if (!my.gaming) return;

    return my.route('roundReady');
  };
  my.interrupt = function() {
    clearTimeout(my.game._rrt);
    clearTimeout(my.game.turnTimer);
    clearTimeout(my.game.hintTimer);
    clearTimeout(my.game.hintTimer2);
    clearTimeout(my.game.qTimer);
  };
  my.roundEnd = function(data) {
    var i; var o; var rw;
    var res = [];
    var users = {};
    var rl;
    var pv = -1;
    var suv = [];
    var teams = [null, [], [], [], []];
    var sumScore = 0;
    var now = (new Date()).getTime();

    my.interrupt();
    for (i in my.players) {
      o = DIC[my.players[i]];
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
    for (i in my.game.seq) {
      o = DIC[my.game.seq[i]] || my.game.seq[i];
      if (!o) continue;
      if (o.robot) {
        if (o.game.team) teams[o.game.team].push(o.game.score);
      } else if (o.team) teams[o.team].push(o.game.score);
    }
    for (i = 1; i < 5; i++) if (o = teams[i].length) teams[i] = [o, teams[i].reduce(function(p, item) { return p + item; }, 0)];
    for (i in my.game.seq) {
      o = DIC[my.game.seq[i]];
      if (!o) continue;
      sumScore += o.game.score;
      res.push({ id: o.id, score: o.team ? teams[o.team][1] : o.game.score, dim: o.team ? teams[o.team][0] : 1 });
    }
    res.sort(function(a, b) { return b.score - a.score; });
    rl = res.length;

    for (i in res) {
      o = DIC[res[i].id];
      if (pv == res[i].score) {
        res[i].rank = res[Number(i) - 1].rank;
      } else {
        res[i].rank = Number(i);
      }
      pv = res[i].score;
      rw = getRewards(my.mode, o.game.score / res[i].dim, o.game.bonus, res[i].rank, rl, sumScore);
      rw.playTime = now - o.playAt;
      o.applyEquipOptions(rw); // 착용 아이템 보너스 적용
      if (rw.together) {
        if (o.game.wpc) o.game.wpc.forEach(function(item) { o.obtain('$WPC' + item, 1); }); // 글자 조각 획득 처리
        o.onOKG(rw.playTime);
      }
      res[i].reward = rw;
      o.data.score += rw.score || 0;
      o.money += rw.money || 0;
      o.data.record[Const.GAME_TYPE[my.mode]][2] += rw.score || 0;
      o.data.record[Const.GAME_TYPE[my.mode]][3] += rw.playTime;
      if (!my.practice && rw.together) {
        o.data.record[Const.GAME_TYPE[my.mode]][0]++;
        if (res[i].rank == 0) o.data.record[Const.GAME_TYPE[my.mode]][1]++;
      }
      users[o.id] = o.getData();

      suv.push(o.flush(true));
    }
    Lizard.all(suv).then(function(uds) {
      var o = {};

      suv = [];
      for (i in uds) {
        o[uds[i].id] = { prev: uds[i].prev };
        suv.push(DB.redis.getSurround(uds[i].id));
      }
      Lizard.all(suv).then(function(ranks) {
        var i; var j;

        for (i in ranks) {
          if (!o[ranks[i].target]) continue;

          o[ranks[i].target].list = ranks[i].data;
        }
        my.byMaster('roundEnd', { result: res, users: users, ranks: o, data: data }, true);
      });
    });
    my.gaming = false;
    my.export();
    delete my.game.seq;
    delete my.game.wordLength;
    delete my.game.dic;
  };
  my.byMaster = function(type, data, nob) {
    if (DIC[my.master]) DIC[my.master].publish(type, data, nob);
  };
  my.export = function(target, kickVote, spec) {
    var obj = { room: my.getData() };
    var i; var o;

    if (!my.rule) return;
    if (target) obj.target = target;
    if (kickVote) obj.kickVote = kickVote;
    if (spec && my.gaming) {
      if (my.rule.rule == 'Classic') {
        if (my.game.chain) obj.chain = my.game.chain.length;
      } else if (my.rule.rule == 'Jaqwi') {
        obj.theme = my.game.theme;
        obj.conso = my.game.conso;
      } else if (my.rule.rule == 'Crossword') {
        obj.prisoners = my.game.prisoners;
        obj.boards = my.game.boards;
        obj.means = my.game.means;
      }
      obj.spec = {};
      for (i in my.game.seq) {
        if (o = DIC[my.game.seq[i]]) obj.spec[o.id] = o.game.score;
      }
    }
    if (my.practice) {
      if (DIC[my.master || target]) DIC[my.master || target].send('room', obj);
    } else {
      publish('room', obj, my.password);
    }
  };
  my.turnStart = function(force) {
    if (!my.gaming) return;

    return my.route('turnStart', force);
  };
  my.readyRobot = function(robot) {
    if (!my.gaming) return;

    return my.route('readyRobot', robot);
  };
  my.turnRobot = function(robot, text, data) {
    if (!my.gaming) return;

    my.submit(robot, text, data);
    //return my.route("turnRobot", robot, text);
  };
  my.turnNext = function(force) {
    if (!my.gaming) return;
    if (!my.game.seq) return;

    my.game.turn = (my.game.turn + 1) % my.game.seq.length;
    my.turnStart(force);
  };
  my.turnEnd = function() {
    return my.route('turnEnd');
  };
  my.submit = function(client, text, data) {
    return my.route('submit', client, text, data);
  };
  my.getScore = function(text, delay, ignoreMission) {
    return my.route('getScore', text, delay, ignoreMission);
  };
  my.getTurnSpeed = function(rt) {
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
  };
  my.getTitle = function() {
    return my.route('getTitle');
  };
  my.route = function(func, ...args) {
    if (!my.gameImplementation) return JLog.warn('Unknown rule: ' + my.rule.rule);
    if (!my.gameImplementation[func]) return JLog.warn('Unknown function: ' + func);
    return my.gameImplementation[func](...args);
  };

  my.set(room);
};

module.exports = Room;