const Cluster = require('cluster');
const JLog = require('kkutu-common/jjlog');
const Const = require('kkutu-common/const');
const Lizard = require('kkutu-common/lizard');
const Data = require('./data');
const Room = require('./room');

const channel = process.env['CHANNEL'] || 0;
const GUEST_IMAGE = '/img/kkutu/guest.png';

// TODO: Const 로 옮기기
const MAX_OKG = 18;
const PER_OKG = 600000;

function getFreeChannel(CHAN, ROOM) {
  var i; var list = {};

  if (Cluster.isMaster) {
    var mk = 1;

    for (i in CHAN) {
      // if(CHAN[i].isDead()) continue;
      list[i] = 0;
    }
    for (i in ROOM) {
      // if(!list.hasOwnProperty(i)) continue;
      mk = ROOM[i].channel;
      list[mk]++;
    }
    for (i in list) {
      if (list[i] < list[mk]) mk = i;
    }
    return Number(mk);
  } else {
    return channel || 0;
  }
}
function getGuestName(sid) {
  var i; var len = sid.length; var res = 0;

  for (i = 0; i < len; i++) {
    res += sid.charCodeAt(i) * (i + 1);
  }
  return 'GUEST' + (1000 + (res % 9000));
}

const Client = function(socket, profile, sid, CHAN, ROOM, guestProfiles, DIC, SHOP, DB, GUEST_PERMISSION, getRid, setRid, publish, onClientClosed, getNIGHT, onClientMessage) {
  var my = this;
  var gp; var okg;

  if (profile) {
    my.id = profile.id;
    my.profile = profile;
    delete my.profile.token;
    delete my.profile.sid;

    if (my.profile.title) my.profile.name = 'anonymous';
  } else {
    gp = guestProfiles[Math.floor(Math.random() * guestProfiles.length)];

    my.id = 'guest__' + sid;
    my.guest = true;
    my.isAjae = false;
    my.profile = {
      id: sid,
      title: getGuestName(sid),
      image: GUEST_IMAGE
    };
  }
  my.socket = socket;
  my.place = 0;
  my.team = 0;
  my.ready = false;
  my.game = {};

  my.subPlace = 0;
  my.error = false;
  my.blocked = false;
  my.spam = 0;
  my._pub = new Date();

  if (Cluster.isMaster) {
    my.onOKG = function(time) {
      // ?? 이럴 일이 없어야 한다.
    };
  } else {
    my.onOKG = function(time) {
      var d = (new Date()).getDate();

      if (my.guest) return;
      if (d != my.data.connectDate) {
        my.data.connectDate = d;
        my.data.playTime = 0;
        my.okgCount = 0;
      }
      my.data.playTime += time;

      while (my.data.playTime >= PER_OKG * (my.okgCount + 1)) {
        if (my.okgCount >= MAX_OKG) return;
        my.okgCount++;
      }
      my.send('okg', { time: my.data.playTime, count: my.okgCount });
      // process.send({ type: 'okg', id: my.id, time: time });
    };
  }
  socket.on('close', function(code) {
    if (ROOM[my.place]) ROOM[my.place].go(my);
    if (my.subPlace) my.pracRoom.go(my);
    onClientClosed(my, code);
  });
  socket.on('message', function(msg) {
    var data; var room = ROOM[my.place];
    if (!my) return;
    if (!msg) return;

    JLog.log(`Chan @${channel} Msg #${my.id}: ${msg}`);
    try { data = JSON.parse(msg); } catch (e) { data = { error: 400 }; }
    if (Cluster.isWorker) process.send({ type: 'tail-report', id: my.id, chan: channel, place: my.place, msg: data.error ? msg : data });

    onClientMessage(my, data);
  });
  my.getData = function(gaming) {
    var o = {
      id: my.id,
      guest: my.guest,
      game: {
        ready: my.ready,
        form: my.form,
        team: my.team,
        practice: my.subPlace,
        score: my.game.score,
        item: my.game.item
      }
    };
    if (!gaming) {
      o.profile = my.profile;
      o.place = my.place;
      o.data = my.data;
      o.money = my.money;
      o.equip = my.equip;
      o.exordial = my.exordial;
    }
    return o;
  };
  my.send = function(type, data) {
    var i; var r = data || {};

    r.type = type;

    if (socket.readyState == 1) socket.send(JSON.stringify(r));
  };
  my.sendError = function(code, msg) {
    my.send('error', { code: code, message: msg });
  };
  my.publish = function(type, data, noBlock) {
    var i;
    var now = new Date(); var st = now - my._pub;

    if (st <= Const.SPAM_ADD_DELAY) my.spam++;
    else if (st >= Const.SPAM_CLEAR_DELAY) my.spam = 0;
    if (my.spam >= Const.SPAM_LIMIT) {
      if (!my.blocked) my.numSpam = 0;
      my.blocked = true;
    }
    if (!noBlock) {
      my._pub = now;
      if (my.blocked) {
        if (st < Const.BLOCKED_LENGTH) {
          if (++my.numSpam >= Const.KICK_BY_SPAM) {
            if (Cluster.isWorker) process.send({ type: 'kick', target: my.id });
            return my.socket.close();
          }
          return my.send('blocked');
        } else my.blocked = false;
      }
    }
    data.profile = my.profile;
    if (my.subPlace && type != 'chat') my.send(type, data);
    else {
      for (i in DIC) {
        if (DIC[i].place == my.place) DIC[i].send(type, data);
      }
    }
    if (Cluster.isWorker && type == 'user') process.send({ type: 'user-publish', data: data });
  };
  my.chat = function(msg, code) {
    if (my.noChat) return my.send('chat', { notice: true, code: 443 });
    my.publish('chat', { value: msg, notice: code ? true : false, code: code });
  };
  my.checkExpire = function() {
    var now = new Date();
    var d = now.getDate();
    var i; var expired = [];
    var gr;

    now = now.getTime() * 0.001;
    if (d != my.data.connectDate) {
      my.data.connectDate = d;
      my.data.playTime = 0;
    }
    for (i in my.box) {
      if (!my.box[i]) {
        delete my.box[i];
        continue;
      }
      if (!my.box[i].expire) continue;
      if (my.box[i].expire < now) {
        gr = SHOP[i].group;

        if (gr.substr(0, 3) == 'BDG') gr = 'BDG';
        if (my.equip[gr] == i) delete my.equip[gr];
        delete my.box[i];
        expired.push(i);
      }
    }
    if (expired.length) {
      my.send('expired', { list: expired });
      my.flush(my.box, my.equip);
    }
  };
  my.refresh = function() {
    var R = new Lizard.Tail();

    if (my.guest) {
      my.equip = {};
      my.data = new Data();
      my.money = 0;
      my.friends = {};

      R.go({ result: 200 });
    } else {
      DB.users.findOne(['_id', my.id]).on(function($user) {
        var first = !$user;
        var black = first ? '' : $user.black;
        /* Enhanced User Block System [S] */
        const blockedUntil = (first || !$user.blockedUntil) ? null : $user.blockedUntil;
        /* Enhanced User Block System [E] */

        if (first) $user = { money: 0 };
        if (black == 'null') black = false;
        if (black == 'chat') {
          black = false;
          my.noChat = true;
        }
        my.exordial = $user.exordial || '';
        my.equip = $user.equip || {};
        my.box = $user.box || {};
        my.data = new Data($user.kkutu);
        my.money = Number($user.money);
        my.friends = $user.friends || {};
        if (first) my.flush();
        else {
          my.checkExpire();
          my.okgCount = Math.floor((my.data.playTime || 0) / PER_OKG);
        }
        /* Enhanced User Block System [S] */
        if (black) {
          if (blockedUntil) R.go({ result: 444, black: black, blockedUntil: blockedUntil });
          else R.go({ result: 444, black: black });
        }
        /* Enhanced User Block System [E] */
        else if (Cluster.isMaster && $user.server) R.go({ result: 409, black: $user.server });
        else if (getNIGHT() && my.isAjae === false) R.go({ result: 440 });
        else R.go({ result: 200 });
      });
    }
    return R;
  };
  my.flush = function(box, equip, friends) {
    var R = new Lizard.Tail();

    if (my.guest) {
      R.go({ id: my.id, prev: 0 });
      return R;
    }
    DB.users.upsert(['_id', my.id]).set(
      !isNaN(my.money) ? ['money', my.money] : undefined,
      (my.data && !isNaN(my.data.score)) ? ['kkutu', my.data] : undefined,
      box ? ['box', my.box] : undefined,
      equip ? ['equip', my.equip] : undefined,
      friends ? ['friends', my.friends] : undefined
    ).on(function(__res) {
      DB.redis.getGlobal(my.id).then(function(_res) {
        DB.redis.putGlobal(my.id, my.data.score).then(function(res) {
          JLog.log(`FLUSHED [${my.id}] PTS=${my.data.score} MNY=${my.money}`);
          R.go({ id: my.id, prev: _res });
        });
      });
    });
    return R;
  };
  my.invokeWordPiece = function(text, coef) {
    if (!my.game.wpc) return;
    var v;

    if (Math.random() <= 0.04 * coef) {
      v = text.charAt(Math.floor(Math.random() * text.length));
      if (!v.match(/[a-z가-힣]/)) return;
      my.game.wpc.push(v);
    }
  };
  my.enter = function(room, spec, pass) {
    var $room; var i;

    if (my.place) {
      my.send('roomStuck');
      JLog.warn(`Enter the room ${room.id} in the place ${my.place} by ${my.id}!`);
      return;
    } else if (room.id) {
      // 이미 있는 방에 들어가기... 여기서 유효성을 검사한다.
      $room = ROOM[room.id];

      if (!$room) {
        if (Cluster.isMaster) {
          for (i in CHAN) CHAN[i].send({ type: 'room-invalid', room: room });
        } else {
          process.send({ type: 'room-invalid', room: room });
        }
        return my.sendError(430, room.id);
      }
      if (!spec) {
        if ($room.gaming) {
          return my.send('error', { code: 416, target: $room.id });
        } else if (my.guest) {
          if (!GUEST_PERMISSION.enter) {
            return my.sendError(401);
          }
        }
      }
      if ($room.players.length >= $room.limit + (spec ? Const.MAX_OBSERVER : 0)) {
        return my.sendError(429);
      }
      if ($room.players.indexOf(my.id) != -1) {
        return my.sendError(409);
      }
      if (Cluster.isMaster) {
        my.send('preRoom', { id: $room.id, pw: room.password, channel: $room.channel });
        CHAN[$room.channel].send({ type: 'room-reserve', session: sid, room: room, spec: spec, pass: pass });

        $room = undefined;
      } else {
        if (!pass && $room) {
          if ($room.kicked.indexOf(my.id) != -1) {
            return my.sendError(406);
          }
          if ($room.password != room.password && $room.password) {
            $room = undefined;
            return my.sendError(403);
          }
        }
      }
    } else if (my.guest && !GUEST_PERMISSION.enter) {
      my.sendError(401);
    } else {
      // 새 방 만들어 들어가기
      /*
				1. 마스터가 ID와 채널을 클라이언트로 보낸다.
				2. 클라이언트가 그 채널 일꾼으로 접속한다.
				3. 일꾼이 만든다.
				4. 일꾼이 만들었다고 마스터에게 알린다.
				5. 마스터가 방 정보를 반영한다.
			*/
      if (Cluster.isMaster) {
        var av = getFreeChannel(CHAN, ROOM);

        room.id = getRid();
        room._create = true;
        my.send('preRoom', { id: getRid(), channel: av });
        CHAN[av].send({ type: 'room-reserve', create: true, session: sid, room: room });

        do {
          setRid(getRid() + 1);
          if (getRid() > 999) setRid(100);
        } while (ROOM[getRid()]);
      } else {
        if (room._id) {
          room.id = room._id;
          delete room._id;
        }
        if (my.place != 0) {
          my.sendError(409);
        }
        $room = new Room(room, getFreeChannel(CHAN, ROOM), getRid(), DIC, ROOM, DB, publish);

        process.send({ type: 'room-new', target: my.id, room: $room.getData() });
        ROOM[$room.id] = $room;
        spec = false;
      }
    }
    if ($room) {
      if (spec) $room.spectate(my, room.password);
      else $room.come(my, room.password, pass);
    }
  };
  my.leave = function(kickVote) {
    var $room = ROOM[my.place];

    if (my.subPlace) {
      my.pracRoom.go(my);
      if ($room) my.send('room', { target: my.id, room: $room.getData() });
      my.publish('user', my.getData());
      if (!kickVote) return;
    }
    if ($room) $room.go(my, kickVote);
  };
  my.setForm = function(mode) {
    var $room = ROOM[my.place];

    if (!$room) return;

    my.form = mode;
    my.ready = false;
    my.publish('user', my.getData());
  };
  my.setTeam = function(team) {
    my.team = team;
    my.publish('user', my.getData());
  };
  my.kick = function(target, kickVote) {
    var $room = ROOM[my.place];
    var i; var $c;
    var len = $room.players.length;

    if (target == null) { // 로봇 (이 경우 kickVote는 로봇의 식별자)
      $room.removeAI(kickVote);
      return;
    }
    for (i in $room.players) {
      if ($room.players[i].robot) len--;
    }
    if (len < 4) kickVote = { target: target, Y: 1, N: 0 };
    if (kickVote) {
      $room.kicked.push(target);
      $room.kickVote = null;
      if (DIC[target]) DIC[target].leave(kickVote);
    } else {
      $room.kickVote = { target: target, Y: 1, N: 0, list: [] };
      for (i in $room.players) {
        $c = DIC[$room.players[i]];
        if (!$c) continue;
        if ($c.id == $room.master) continue;

        $c.kickTimer = setTimeout($c.kickVote, 10000, $c, true);
      }
      my.publish('kickVote', $room.kickVote, true);
    }
  };
  my.kickVote = function(client, agree) {
    var $room = ROOM[client.place];
    var $m;

    if (!$room) return;

    $m = DIC[$room.master];
    if ($room.kickVote) {
      $room.kickVote[agree ? 'Y' : 'N']++;
      if ($room.kickVote.list.push(client.id) >= $room.players.length - 2) {
        if ($room.gaming) return;

        if ($room.kickVote.Y >= $room.kickVote.N) $m.kick($room.kickVote.target, $room.kickVote);
        else $m.publish('kickDeny', { target: $room.kickVote.target, Y: $room.kickVote.Y, N: $room.kickVote.N }, true);

        $room.kickVote = null;
      }
    }
    clearTimeout(client.kickTimer);
  };
  my.toggle = function() {
    var $room = ROOM[my.place];

    if (!$room) return;
    if ($room.master == my.id) return;
    if (my.form != 'J') return;

    my.ready = !my.ready;
    my.publish('user', my.getData());
  };
  my.start = function() {
    var $room = ROOM[my.place];

    if (!$room) return;
    if ($room.master != my.id) return;
    if ($room.players.length < 2) return my.sendError(411);

    $room.ready();
  };
  my.practice = function(level) {
    var $room = ROOM[my.place];
    var ud;
    var pr;

    if (!$room) return;
    if (my.subPlace) return;
    if (my.form != 'J') return;

    my.team = 0;
    my.ready = false;
    ud = my.getData();
    my.pracRoom = new Room($room.getData(), undefined, getRid(), DIC, ROOM, DB, publish);
    my.pracRoom.id = $room.id + 1000;
    ud.game.practice = my.pracRoom.id;
    if (pr = $room.preReady()) return my.sendError(pr);
    my.publish('user', ud);
    my.pracRoom.time /= my.pracRoom.rule.time;
    my.pracRoom.limit = 1;
    my.pracRoom.password = '';
    my.pracRoom.practice = true;
    my.subPlace = my.pracRoom.id;
    my.pracRoom.come(my);
    my.pracRoom.start(level);
    my.pracRoom.game.hum = 1;
  };
  my.setRoom = function(room) {
    var $room = ROOM[my.place];

    if ($room) {
      if (!$room.gaming) {
        if ($room.master == my.id) {
          $room.set(room);
          publish('room', { target: my.id, room: $room.getData(), modify: true }, room.password);
        } else {
          my.sendError(400);
        }
      }
    } else {
      my.sendError(400);
    }
  };
  my.applyEquipOptions = function(rw) {
    var $obj;
    var i; var j;
    var pm = rw.playTime / 60000;

    rw._score = Math.round(rw.score);
    rw._money = Math.round(rw.money);
    rw._blog = [];
    my.checkExpire();
    for (i in my.equip) {
      $obj = SHOP[my.equip[i]];
      if (!$obj) continue;
      if (!$obj.options) continue;
      for (j in $obj.options) {
        if (j == 'gEXP') rw.score += rw._score * $obj.options[j];
        else if (j == 'hEXP') rw.score += $obj.options[j] * pm;
        else if (j == 'gMNY') rw.money += rw._money * $obj.options[j];
        else if (j == 'hMNY') rw.money += $obj.options[j] * pm;
        else continue;
        rw._blog.push('q' + j + $obj.options[j]);
      }
    }
    if (rw.together && my.okgCount > 0) {
      i = 0.05 * my.okgCount;
      j = 0.05 * my.okgCount;

      rw.score += rw._score * i;
      rw.money += rw._money * j;
      rw._blog.push('kgEXP' + i);
      rw._blog.push('kgMNY' + j);
    }
    rw.score = Math.round(rw.score);
    rw.money = Math.round(rw.money);
  };
  my.obtain = function(k, q, flush) {
    if (my.guest) return;
    if (my.box[k]) my.box[k] += q;
    else my.box[k] = q;

    my.send('obtain', { key: k, q: q });
    if (flush) my.flush(true);
  };
  my.addFriend = function(id) {
    var fd = DIC[id];

    if (!fd) return;
    my.friends[id] = fd.profile.title || fd.profile.name;
    my.flush(false, false, true);
    my.send('friendEdit', { friends: my.friends });
  };
  my.removeFriend = function(id) {
    DB.users.findOne(['_id', id]).limit(['friends', true]).on(function($doc) {
      if (!$doc) return;

      var f = $doc.friends;

      delete f[my.id];
      DB.users.update(['_id', id]).set(['friends', f]).on();
    });
    delete my.friends[id];
    my.flush(false, false, true);
    my.send('friendEdit', { friends: my.friends });
  };
};

module.exports = Client;