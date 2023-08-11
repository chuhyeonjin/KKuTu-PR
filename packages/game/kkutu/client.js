const Cluster = require('cluster');
const JLog = require('kkutu-common/jjlog');
const Const = require('kkutu-common/const');
const Lizard = require('kkutu-common/lizard');
const Data = require('./data');
const Room = require('./room');

const channel = process.env['CHANNEL'] || 0;
const GUEST_IMAGE = '/img/kkutu/guest.png';

function getFreeChannel(CHAN, ROOM) {
  if (Cluster.isMaster) {
    const list = {};

    for (const i in CHAN) {
      // if(CHAN[i].isDead()) continue;
      list[i] = 0;
    }

    let mk = 1;
    for (const i in ROOM) {
      // if(!list.hasOwnProperty(i)) continue;
      mk = ROOM[i].channel;
      list[mk]++;
    }
    for (const i in list) {
      if (list[i] < list[mk]) mk = i;
    }

    return Number(mk);
  } else {
    return channel || 0;
  }
}
function getGuestName(sid) {
  let res = 0;
  for (let i = 0; i < sid.length; i++) {
    res += sid.charCodeAt(i) * (i + 1);
  }
  return 'GUEST' + (1000 + (res % 9000));
}

class Client {
  constructor(socket, profile, sid, CHAN, ROOM, guestProfiles, DIC, SHOP, DB, GUEST_PERMISSION, getRid, setRid, publish, onClientClosed, getNIGHT, onClientMessage) {
    if (profile) {
      this.id = profile.id;
      this.profile = profile;
      delete this.profile.token;
      delete this.profile.sid;

      if (this.profile.title) this.profile.name = 'anonymous';
    } else {
      this.id = 'guest__' + sid;
      this.guest = true;
      this.isAjae = false;
      this.profile = {
        id: sid,
        title: getGuestName(sid),
        image: GUEST_IMAGE
      };
    }

    this.socket = socket;
    this.sid = sid;
    this.CHAN = CHAN;
    this.ROOM = ROOM;
    this.DIC = DIC;
    this.SHOP = SHOP;
    this.DB = DB;
    this.GUEST_PERMISSION = GUEST_PERMISSION;
    this.getRid = getRid;
    this.setRid = setRid;
    this.kkutuPublish = publish;
    this.getNIGHT = getNIGHT;

    this.place = 0;
    this.team = 0;
    this.ready = false;
    this.game = {};

    this.subPlace = 0;
    this.error = false;
    this.blocked = false;
    this.spam = 0;
    this._pub = new Date();

    if (Cluster.isMaster) {
      this.onOKG = () => { /* ?? 이럴 일이 없어야 한다. */ };
    } else {
      this.onOKG = (time) => {
        if (this.guest) return;

        const today = (new Date()).getDate();
        if (today != this.data.connectDate) {
          this.data.connectDate = today;
          this.data.playTime = 0;
          this.okgCount = 0;
        }
        this.data.playTime += time;

        while (this.data.playTime >= Const.PER_OKG * (this.okgCount + 1)) {
          if (this.okgCount >= Const.MAX_OKG) return;
          this.okgCount++;
        }
        this.send('okg', { time: this.data.playTime, count: this.okgCount });
        // process.send({ type: 'okg', id: this.id, time: time });
      };
    }

    socket.on('close', (code) => {
      if (ROOM[this.place]) ROOM[this.place].go(this);
      if (this.subPlace) this.pracRoom.go(this);
      onClientClosed(this, code);
    });

    socket.on('message', (msg) => {
      var data;
      if (!this) return;
      if (!msg) return;

      JLog.log(`Chan @${channel} Msg #${this.id}: ${msg}`);
      try { data = JSON.parse(msg); } catch (e) { data = { error: 400 }; }
      if (Cluster.isWorker) process.send({ type: 'tail-report', id: this.id, chan: channel, place: this.place, msg: data.error ? msg : data });

      onClientMessage(this, data);
    });
  }

  getData(gaming) {
    var o = {
      id: this.id,
      guest: this.guest,
      game: {
        ready: this.ready,
        form: this.form,
        team: this.team,
        practice: this.subPlace,
        score: this.game.score,
        item: this.game.item
      }
    };
    if (!gaming) {
      o.profile = this.profile;
      o.place = this.place;
      o.data = this.data;
      o.money = this.money;
      o.equip = this.equip;
      o.exordial = this.exordial;
    }
    return o;
  }

  send(type, data) {
    var i; var r = data || {};

    r.type = type;

    if (this.socket.readyState == 1) this.socket.send(JSON.stringify(r));
  }

  sendError(code, msg) {
    this.send('error', { code: code, message: msg });
  }

  publish(type, data, noBlock) {
    var i;
    var now = new Date(); var st = now - this._pub;

    if (st <= Const.SPAM_ADD_DELAY) this.spam++;
    else if (st >= Const.SPAM_CLEAR_DELAY) this.spam = 0;
    if (this.spam >= Const.SPAM_LIMIT) {
      if (!this.blocked) this.numSpam = 0;
      this.blocked = true;
    }
    if (!noBlock) {
      this._pub = now;
      if (this.blocked) {
        if (st < Const.BLOCKED_LENGTH) {
          if (++this.numSpam >= Const.KICK_BY_SPAM) {
            if (Cluster.isWorker) process.send({ type: 'kick', target: this.id });
            return this.socket.close();
          }
          return this.send('blocked');
        } else this.blocked = false;
      }
    }
    data.profile = this.profile;
    if (this.subPlace && type != 'chat') this.send(type, data);
    else {
      for (i in this.DIC) {
        if (this.DIC[i].place == this.place) this.DIC[i].send(type, data);
      }
    }
    if (Cluster.isWorker && type == 'user') process.send({ type: 'user-publish', data: data });
  }

  chat(msg, code) {
    if (this.noChat) return this.send('chat', { notice: true, code: 443 });
    this.publish('chat', { value: msg, notice: code ? true : false, code: code });
  }

  checkExpire() {
    var now = new Date();
    var d = now.getDate();
    var i; var expired = [];
    var gr;

    now = now.getTime() * 0.001;
    if (d != this.data.connectDate) {
      this.data.connectDate = d;
      this.data.playTime = 0;
    }
    for (i in this.box) {
      if (!this.box[i]) {
        delete this.box[i];
        continue;
      }
      if (!this.box[i].expire) continue;
      if (this.box[i].expire < now) {
        gr = this.SHOP[i].group;

        if (gr.substr(0, 3) == 'BDG') gr = 'BDG';
        if (this.equip[gr] == i) delete this.equip[gr];
        delete this.box[i];
        expired.push(i);
      }
    }
    if (expired.length) {
      this.send('expired', { list: expired });
      this.flush(this.box, this.equip);
    }
  }

  refresh() {
    var R = new Lizard.Tail();

    if (this.guest) {
      this.equip = {};
      this.data = new Data();
      this.money = 0;
      this.friends = {};

      R.go({ result: 200 });
    } else {
      this.DB.users.findOne(['_id', this.id]).on(($user) => {
        var first = !$user;
        var black = first ? '' : $user.black;
        /* Enhanced User Block System [S] */
        const blockedUntil = (first || !$user.blockedUntil) ? null : $user.blockedUntil;
        /* Enhanced User Block System [E] */

        if (first) $user = { money: 0 };
        if (black == 'null') black = false;
        if (black == 'chat') {
          black = false;
          this.noChat = true;
        }
        this.exordial = $user.exordial || '';
        this.equip = $user.equip || {};
        this.box = $user.box || {};
        this.data = new Data($user.kkutu);
        this.money = Number($user.money);
        this.friends = $user.friends || {};
        if (first) this.flush();
        else {
          this.checkExpire();
          this.okgCount = Math.floor((this.data.playTime || 0) / Const.PER_OKG);
        }
        /* Enhanced User Block System [S] */
        if (black) {
          if (blockedUntil) R.go({ result: 444, black: black, blockedUntil: blockedUntil });
          else R.go({ result: 444, black: black });
        }
        /* Enhanced User Block System [E] */
        else if (Cluster.isMaster && $user.server) R.go({ result: 409, black: $user.server });
        else if (this.getNIGHT() && this.isAjae === false) R.go({ result: 440 });
        else R.go({ result: 200 });
      });
    }
    return R;
  }

  flush(box, equip, friends) {
    var R = new Lizard.Tail();

    if (this.guest) {
      R.go({ id: this.id, prev: 0 });
      return R;
    }
    this.DB.users.upsert(['_id', this.id]).set(
      !isNaN(this.money) ? ['money', this.money] : undefined,
      (this.data && !isNaN(this.data.score)) ? ['kkutu', this.data] : undefined,
      box ? ['box', this.box] : undefined,
      equip ? ['equip', this.equip] : undefined,
      friends ? ['friends', this.friends] : undefined
    ).on((__res) => {
      this.DB.redis.getGlobal(this.id).then((_res) => {
        this.DB.redis.putGlobal(this.id, this.data.score).then((res) => {
          JLog.log(`FLUSHED [${this.id}] PTS=${this.data.score} MNY=${this.money}`);
          R.go({ id: this.id, prev: _res });
        });
      });
    });
    return R;
  }

  invokeWordPiece(text, coef) {
    if (!this.game.wpc) return;
    var v;

    if (Math.random() <= 0.04 * coef) {
      v = text.charAt(Math.floor(Math.random() * text.length));
      if (!v.match(/[a-z가-힣]/)) return;
      this.game.wpc.push(v);
    }
  }

  enter(room, spec, pass) {
    var $room; var i;

    if (this.place) {
      this.send('roomStuck');
      JLog.warn(`Enter the room ${room.id} in the place ${this.place} by ${this.id}!`);
      return;
    } else if (room.id) {
      // 이미 있는 방에 들어가기... 여기서 유효성을 검사한다.
      $room = this.ROOM[room.id];

      if (!$room) {
        if (Cluster.isMaster) {
          for (i in this.CHAN) this.CHAN[i].send({ type: 'room-invalid', room: room });
        } else {
          process.send({ type: 'room-invalid', room: room });
        }
        return this.sendError(430, room.id);
      }
      if (!spec) {
        if ($room.gaming) {
          return this.send('error', { code: 416, target: $room.id });
        } else if (this.guest) {
          if (!this.GUEST_PERMISSION.enter) {
            return this.sendError(401);
          }
        }
      }
      if ($room.players.length >= $room.limit + (spec ? Const.MAX_OBSERVER : 0)) {
        return this.sendError(429);
      }
      if ($room.players.indexOf(this.id) != -1) {
        return this.sendError(409);
      }
      if (Cluster.isMaster) {
        this.send('preRoom', { id: $room.id, pw: room.password, channel: $room.channel });
        this.CHAN[$room.channel].send({ type: 'room-reserve', session: this.sid, room: room, spec: spec, pass: pass });

        $room = undefined;
      } else {
        if (!pass && $room) {
          if ($room.kicked.indexOf(this.id) != -1) {
            return this.sendError(406);
          }
          if ($room.password != room.password && $room.password) {
            $room = undefined;
            return this.sendError(403);
          }
        }
      }
    } else if (this.guest && !this.GUEST_PERMISSION.enter) {
      this.sendError(401);
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
        var av = getFreeChannel(this.CHAN, this.ROOM);

        room.id = this.getRid();
        room._create = true;
        this.send('preRoom', { id: this.getRid(), channel: av });
        this.CHAN[av].send({ type: 'room-reserve', create: true, session: this.sid, room: room });

        do {
          this.setRid(this.getRid() + 1);
          if (this.getRid() > 999) this.setRid(100);
        } while (this.ROOM[this.getRid()]);
      } else {
        if (room._id) {
          room.id = room._id;
          delete room._id;
        }
        if (this.place != 0) {
          this.sendError(409);
        }
        $room = new Room(room, getFreeChannel(this.CHAN, this.ROOM), this.getRid(), this.DIC, this.ROOM, this.DB, this.kkutuPublish);

        process.send({ type: 'room-new', target: this.id, room: $room.getData() });
        this.ROOM[$room.id] = $room;
        spec = false;
      }
    }
    if ($room) {
      if (spec) $room.spectate(this, room.password);
      else $room.come(this, room.password, pass);
    }
  }

  leave(kickVote) {
    var $room = this.ROOM[this.place];

    if (this.subPlace) {
      this.pracRoom.go(this);
      if ($room) this.send('room', { target: this.id, room: $room.getData() });
      this.publish('user', this.getData());
      if (!kickVote) return;
    }
    if ($room) $room.go(this, kickVote);
  }

  setForm(mode) {
    var $room = this.ROOM[this.place];

    if (!$room) return;

    this.form = mode;
    this.ready = false;
    this.publish('user', this.getData());
  }
  
  setTeam(team) {
    this.team = team;
    this.publish('user', this.getData());
  }

  kick(target, kickVote) {
    var $room = this.ROOM[this.place];
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
      if (this.DIC[target]) this / this.DIC[target].leave(kickVote);
    } else {
      $room.kickVote = { target: target, Y: 1, N: 0, list: [] };
      for (i in $room.players) {
        $c = this.DIC[$room.players[i]];
        if (!$c) continue;
        if ($c.id == $room.master) continue;

        $c.kickTimer = setTimeout(() => { $c.kickVote($c, true); }, 10000);
      }
      this.publish('kickVote', $room.kickVote, true);
    }
  }

  kickVote(client, agree) {
    const $room = this.ROOM[client.place];
    if (!$room) return;

    const master = this.DIC[$room.master];
    if ($room.kickVote) {
      $room.kickVote[agree ? 'Y' : 'N']++;
      if ($room.kickVote.list.push(client.id) >= $room.players.length - 2) {
        if ($room.gaming) return;

        if ($room.kickVote.Y >= $room.kickVote.N) master.kick($room.kickVote.target, $room.kickVote);
        else master.publish('kickDeny', { target: $room.kickVote.target, Y: $room.kickVote.Y, N: $room.kickVote.N }, true);

        $room.kickVote = null;
      }
    }
    clearTimeout(client.kickTimer);
  }

  toggle() {
    const $room = this.ROOM[this.place];

    if (!$room) return;
    if ($room.master == this.id) return;
    if (this.form != 'J') return;

    this.ready = !this.ready;
    this.publish('user', this.getData());
  }

  start() {
    const $room = this.ROOM[this.place];

    if (!$room) return;
    if ($room.master != this.id) return;
    if ($room.players.length < 2) return this.sendError(411);

    $room.ready();
  }

  practice(level) {
    if (this.subPlace) return;
    if (this.form != 'J') return;

    const $room = this.ROOM[this.place];
    if (!$room) return;

    this.team = 0;
    this.ready = false;

    const ud = this.getData();
    this.pracRoom = new Room($room.getData(), undefined, this.getRid(), this.DIC, this.ROOM, this.DB, this.kkutuPublish);

    this.pracRoom.id = $room.id + 1000;
    ud.game.practice = this.pracRoom.id;
    const pr = $room.preReady();
    if (pr) return this.sendError(pr);
    this.publish('user', ud);
    this.pracRoom.time /= this.pracRoom.rule.time;
    this.pracRoom.limit = 1;
    this.pracRoom.password = '';
    this.pracRoom.practice = true;
    this.subPlace = this.pracRoom.id;
    this.pracRoom.come(this);
    this.pracRoom.start(level);
    this.pracRoom.game.hum = 1;
  }

  setRoom(room) {
    const $room = this.ROOM[this.place];

    if (!$room) return this.sendError(400);
    if ($room.gaming) return;
    if ($room.master != this.id) return this.sendError(400);

    $room.set(room);
    this.kkutuPublish('room', { target: this.id, room: $room.getData(), modify: true }, room.password);
  }

  applyEquipOptions(rewards) {
    const playTimeInMinutes = rewards.playTime / 60000;

    rewards._score = Math.round(rewards.score);
    rewards._money = Math.round(rewards.money);
    rewards._blog = [];
    this.checkExpire();

    for (const i in this.equip) {
      const item = this.SHOP[this.equip[i]];
      if (!item) continue;
      if (!item.options) continue;

      for (const j in item.options) {
        if (j == 'gEXP') rewards.score += rewards._score * item.options[j];
        else if (j == 'hEXP') rewards.score += item.options[j] * playTimeInMinutes;
        else if (j == 'gMNY') rewards.money += rewards._money * item.options[j];
        else if (j == 'hMNY') rewards.money += item.options[j] * playTimeInMinutes;
        else continue;

        rewards._blog.push('q' + j + item.options[j]);
      }
    }

    if (rewards.together && this.okgCount > 0) {
      const okgScoreMultiplier = 0.05 * this.okgCount;
      const okgMoneyMultiplier = 0.05 * this.okgCount;

      rewards.score += rewards._score * okgScoreMultiplier;
      rewards.money += rewards._money * okgMoneyMultiplier;
      rewards._blog.push('kgEXP' + okgScoreMultiplier);
      rewards._blog.push('kgMNY' + okgMoneyMultiplier);
    }

    rewards.score = Math.round(rewards.score);
    rewards.money = Math.round(rewards.money);
  }

  obtain(k, q, flush) {
    if (this.guest) return;

    if (this.box[k]) this.box[k] += q;
    else this.box[k] = q;

    this.send('obtain', { key: k, q: q });
    if (flush) this.flush(true);
  }

  addFriend(id) {
    const target = this.DIC[id];
    if (!target) return;
    
    this.friends[id] = target.profile.title || target.profile.name;
    this.flush(false, false, true);
    this.send('friendEdit', { friends: this.friends });
  }

  removeFriend(id) {
    this.DB.users.findOne(['_id', id]).limit(['friends', true]).on(($doc) => {
      if (!$doc) return;

      const friends = $doc.friends;

      delete friends[this.id];
      this.DB.users.update(['_id', id]).set(['friends', friends]).on();
    });
    delete this.friends[id];
    this.flush(false, false, true);
    this.send('friendEdit', { friends: this.friends });
  }
}

module.exports = Client;