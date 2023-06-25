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

const JLog = require('kkutu-common/jjlog');
const Const = require('kkutu-common/const');
const MainDB = require('kkutu-common/db');
const File = require('fs');
const KKuTu = require('./kkutu');
const { createWebSocketServer } = require('./websocket');

const GLOBAL = require('../../config/global.json');


const Server = createWebSocketServer();

const DIC = {};
/**
 * 사용자 이름이 키고, ID가 값인 오브젝트
 * @type {Record<string, string>}
 */
const DNAME = {};
const ROOM = {};
const RESERVED = {};

const CHAN = process.env['CHANNEL'];
const DEVELOP = global.test || false;
const GUEST_PERMISSION = Const.GUEST_PERMISSION;
const ENABLED_ROUND_TIME = Const.ENABLED_ROUND_TIME;
const ENABLED_FORM = Const.ENABLED_FORM;
const MODE_LENGTH = Const.MODE_LENGTH;

JLog.info(`<< KKuTu Server:${Server.options.port} >>`);

process.on('uncaughtException', (err) => {
  for (const i in DIC) {
    DIC[i].send('dying');
  }

  const dateString = new Date().toLocaleString();
  const port = process.env['KKUTU_PORT'];
  const text = `:${port} [${dateString}] ERROR: ${err.toString()}\n${err.stack}`;

  File.appendFileSync('../../KKUTU_ERROR.log', text);
  JLog.error(`ERROR OCCURRED! This worker will die in 10 seconds.`);
  console.log(text);
  setTimeout(() => { process.exit(); }, 10000);
});

process.on('message', (msg) => {
  switch (msg.type) {
  case 'invite-error':
    if (!DIC[msg.target]) break;
    DIC[msg.target].sendError(msg.code);
    break;
  case 'room-reserve':
    // 이미 입장 요청을 했는데 또 하는 경우
    if (RESERVED[msg.session]) {
      break;
    }

    RESERVED[msg.session] = {
      profile: msg.profile,
      room: msg.room,
      spec: msg.spec,
      pass: msg.pass,
      _expiration: setTimeout((tg, create) => {
        process.send({ type: 'room-expired', id: msg.room.id, create: create });
        delete RESERVED[tg];
      }, 10000, msg.session, msg.create)
    };
    break;
  case 'room-invalid':
    delete ROOM[msg.room.id];
    break;
  default:
    JLog.warn(`Unhandled IPC message type: ${msg.type}`);
  }
});

MainDB.ready = () => {
  JLog.success('DB is ready.');
  KKuTu.init(MainDB, DIC, ROOM, GUEST_PERMISSION);
};

Server.on('connection', (socket, info) => {
  const chunk = info.url.slice(1).split('&');
  const [key, channel] = chunk;

  socket.on('error', (err) => {
    JLog.warn(`Error on #${key} on ws: ${err.toString()}`);
  });

  if (CHAN !== channel) {
    JLog.warn(`Wrong channel value ${channel} on @${CHAN}`);
    socket.close();
    return;
  }

  const reserve = RESERVED[key] || {};
  const room = reserve.room;

  if (room) {
    if (room._create) {
      room._id = room.id;
      delete room.id;
    }
    clearTimeout(reserve._expiration);
    delete reserve._expiration;
    delete RESERVED[key];
  } else {
    JLog.warn(`Not reserved from ${key} on @${CHAN}`);
    socket.close();
    return;
  }


  MainDB.session.findOne(['_id', key]).limit(['profile', true]).on(($body) => {
    const $c = new KKuTu.Client(socket, $body ? $body.profile : null, key);
    $c.admin = GLOBAL.ADMIN.includes($c.id);

    /* Enhanced User Block System [S] */
    function getRemoteAddress(useXForwardedFor) {
      return useXForwardedFor ?
        info.connection.remoteAddress :
        (info.headers['x-forwarded-for'] || info.connection.remoteAddress);
    }
    $c.remoteAddress = getRemoteAddress(GLOBAL.USER_BLOCK_OPTIONS.USE_X_FORWARDED_FOR);

    const isRequireToTestIpBlocked =
      !GLOBAL.USER_BLOCK_OPTIONS.BLOCK_IP_ONLY_FOR_GUEST ||
      (GLOBAL.USER_BLOCK_OPTIONS.BLOCK_IP_ONLY_FOR_GUEST && $c.guest);

    if (GLOBAL.USER_BLOCK_OPTIONS.USE_MODULE && isRequireToTestIpBlocked) {
      MainDB.ip_block.findOne(['_id', $c.remoteAddress]).on(($body) => {
        if ($body.reasonBlocked) {
          $c.socket.send(JSON.stringify({
            type: 'error',
            code: 446,
            reasonBlocked: !$body.reasonBlocked ? GLOBAL.USER_BLOCK_OPTIONS.DEFAULT_BLOCKED_TEXT : $body.reasonBlocked,
            ipBlockedUntil: !$body.ipBlockedUntil ? GLOBAL.USER_BLOCK_OPTIONS.BLOCKED_FOREVER : $body.ipBlockedUntil
          }));
          $c.socket.close();
        }
      });
    }
    /* Enhanced User Block System [E] */

    if (DIC[$c.id]) {
      DIC[$c.id].send('error', { code: 408 });
      DIC[$c.id].socket.close();
    }

    if (DEVELOP && !Const.TESTER.includes($c.id)) {
      $c.send('error', { code: 500 });
      $c.socket.close();
      return;
    }

    $c.refresh().then((ref) => {
      if (ref.result !== 200) {
        $c.send('error', {
          code: ref.result, message: ref.black
        });
        $c._error = ref.result;
        $c.socket.close();
        return;
      }

      DIC[$c.id] = $c;
      DNAME[($c.profile.title || $c.profile.name).replace(/\s/g, '')] = $c.id;

      $c.enter(room, reserve.spec, reserve.pass);
      if ($c.place == room.id) {
        $c.publish('connRoom', { user: $c.getData() });
      } else { // 입장 실패
        $c.socket.close();
      }
      JLog.info(`Chan @${CHAN} New #${$c.id}`);
    });
  });
});

Server.on('error', (err) => { JLog.warn(`Error on ws: ${err.toString()}`); });

KKuTu.onClientClosed = (client) => {
  delete DIC[client.id];

  if (client.profile) delete DNAME[client.profile.title || client.profile.name];
  if (client.socket) client.socket.removeAllListeners();
  KKuTu.publish('disconnRoom', { id: client.id });

  JLog.alert(`Chan @${CHAN} Exit #${client.id}`);
};

function onClientYell(client, { value }) {
  if (!value) return;
  if (!client.admin) return;

  client.publish('yell', { value });
}

function onClientTalk(client, msg) {
  const { value, relay: isRelay, data, whisper } = msg;

  if (!value || typeof value !== 'string') return;

  if (!GUEST_PERMISSION.talk && client.guest) {
    client.send('error', { code: 401 });
    return;
  }

  const slicedValue = value.slice(0, 200);
  msg.value = slicedValue;

  function getCurrentRoom(client) {
    if (client.subPlace) return client.pracRoom;
    return ROOM[client.place];
  }

  if (isRelay) {
    const currentRoom = getCurrentRoom(client);
    if (!currentRoom || !currentRoom.gaming) return;

    if (currentRoom.game.late) {
      client.chat(slicedValue);
      return;
    }

    if (!currentRoom.game.loading) {
      currentRoom.submit(client, slicedValue, data);
    }

    return;
  }

  if (client.admin && slicedValue.startsWith('#')) {
    process.send({ type: 'admin', id: client.id, value: slicedValue });
    return;
  }

  if (whisper) {
    process.send({ type: 'tail-report', id: client.id, chan: CHAN, place: client.place, msg });
    whisper.split(',').forEach((v) => {
      const target = DIC[DNAME[v]];
      if (target) {
        target.send('chat', {
          from: client.profile.title || client.profile.name,
          profile: client.profile,
          value: slicedValue
        });
      } else {
        client.sendError(424, v);
      }
    });
    return;
  }

  client.chat(slicedValue);
}

/**
 * onClientMessage 에서 메세지 타입이 setRoom 이거나 Enter 일때 메시지의 값들을 검사합니다.
 * 이름과 달리 msg 를 검사하는것 뿐만 아니라 msg 의 값을 수정합니다.
 *
 * @returns {boolean} isMessageStable
 */
function checkRoomMessageStable(msg) {
  let isMessageStable = true;

  msg.code = false;

  if (!msg.title || !msg.opts) isMessageStable = false;

  msg.limit = Number(msg.limit);
  msg.mode = Number(msg.mode);
  msg.round = Number(msg.round);
  msg.time = Number(msg.time);

  if (isNaN(msg.mode)) isMessageStable = false;
  if (!msg.limit) isMessageStable = false;
  if (!msg.round) isMessageStable = false;
  if (!msg.time) isMessageStable = false;

  if (isMessageStable) {
    if (msg.title.length > 20) isMessageStable = false;
    if (msg.password.length > 20) isMessageStable = false;
    if (msg.limit < 2 || msg.limit > 8) {
      msg.code = 432;
      isMessageStable = false;
    }
    if (msg.mode < 0 || msg.mode >= MODE_LENGTH) isMessageStable = false;
    if (msg.round < 1 || msg.round > 10) {
      msg.code = 433;
      isMessageStable = false;
    }
    if (!ENABLED_ROUND_TIME.includes(msg.time)) isMessageStable = false;
  }

  return isMessageStable;
}

function onClientSetRoom(client, msg) {
  const isMessageStable = checkRoomMessageStable(msg);

  if (!isMessageStable) {
    client.sendError(msg.code || 431);
    return;
  }

  client.setRoom(msg);
}

function onClientEnter(client, msg) {
  const isMessageStable = checkRoomMessageStable(msg);

  if (msg.id || isMessageStable) client.enter(msg, msg.spectate);
  else client.sendError(msg.code || 431);
}

function onClientStart(client) {
  if (!client.place) return;
  if (!ROOM[client.place]) return;
  if (ROOM[client.place].gaming) return;
  if (!GUEST_PERMISSION.start && client.guest) return;

  client.start();
}

function isRobotLevelValid(level, ruleHasAI) {
  if (ruleHasAI) {
    if (level < 0 || level >= 5) return false;
  } else {
    if (level !== -1) return false;
  }

  return true;
}

function onClientPractice(client, msg) {
  const currentRoom = ROOM[client.place];
  if (!currentRoom) return;
  if (currentRoom.gaming) return;
  if (!GUEST_PERMISSION.practice && client.guest) return;

  msg.level = Number(msg.level);
  if (isNaN(msg.level)) return;
  if (!isRobotLevelValid(msg.level, currentRoom.rule.ai)) return;

  client.practice(msg.level);
}

function onClientInvite(client, msg) {
  const currentRoom = ROOM[client.place];

  if (!currentRoom) return;
  if (currentRoom.gaming) return;
  if (currentRoom.master !== client.id) return;
  if (!GUEST_PERMISSION.invite && client.guest) return;

  if (msg.target === 'AI') {
    currentRoom.addAI(client);
  } else {
    process.send({ type: 'invite', id: client.id, place: client.place, target: msg.target });
  }
}

function onClientInviteRes(client, msg) {
  const inviteFrom = ROOM[msg.from];
  if (!inviteFrom) return;
  if (!GUEST_PERMISSION.inviteRes && client.guest) return;

  if (msg.res) {
    client.enter({ id: msg.from }, false, true);
  } else {
    if (DIC[inviteFrom.master]) DIC[inviteFrom.master].send('inviteNo', { target: client.id });
  }
}

function onClientTeam(client, msg) {
  const currentRoom = ROOM[client.place];

  if (!currentRoom) return;
  if (currentRoom.gaming) return;
  if (client.ready) return;

  const team = Number(msg.value);
  if (isNaN(team)) return;
  if (team < 0 || team > 4) return;

  client.setTeam(Math.round(team));
}

function onClientKick(client, msg) {
  const currentRoom = ROOM[client.place];

  if (currentRoom.master !== client.id) return;
  if (!GUEST_PERMISSION.kick && client.guest) return;

  if (!currentRoom) return;
  if (currentRoom.gaming) return;
  if (currentRoom.kickVote) return;

  if (msg.robot) {
    client.kick(null, msg.target);
    return;
  }

  const target = DIC[msg.target];

  if (!target) return;
  if (client.place !== target.place) return;

  client.kick(msg.target);
}

function onClientKickVote(client, msg) {
  const currentRoom = ROOM[client.place];
  if (!currentRoom) return;
  if (!currentRoom.kickVote) return;

  if (client.id === currentRoom.kickVote.target) return;
  if (client.id === currentRoom.master) return;
  if (currentRoom.kickVote.list.includes(client.id)) return;
  if (!GUEST_PERMISSION.kickVote && client.guest) return;

  client.kickVote(client, msg.agree);
}

function onClientHandover(client, msg) {
  if (!DIC[msg.target]) return;
  if (client.place !== DIC[msg.target].place) return;

  const currentRoom = ROOM[client.place];
  if (!currentRoom) return;
  if (currentRoom.gaming) return;
  if (currentRoom.master !== client.id) return;

  currentRoom.master = msg.target;
  currentRoom.export();
}

function onClientWp(client, msg) {
  if (!msg.value) return;
  if (!GUEST_PERMISSION.wp && client.guest) {
    client.send('error', { code: 401 });
    return;
  }

  msg.value = msg.value.slice(0, 200);
  msg.value = msg.value.replace(/[^a-z가-힣]/g, '');
  if (msg.value.length < 2) return;
}

function onClientSetAI(client, msg) {
  if (!msg.target) return;

  const currentRoom = ROOM[client.place];
  if (!currentRoom) return;
  if (currentRoom.gaming) return;
  if (currentRoom.master !== client.id) return;

  msg.level = Number(msg.level);
  if (isNaN(msg.level)) return;
  if (msg.level < 0 || msg.level >= 5) return;

  msg.team = Number(msg.team);
  if (isNaN(msg.team)) return;
  if (msg.team < 0 || msg.team > 4) return;

  currentRoom.setAI(msg.target, Math.round(msg.level), Math.round(msg.team));
}

KKuTu.onClientMessage = (client, msg) => {
  if (!msg) return;

  switch (msg.type) {
  case 'yell':
    onClientYell(client, msg);
    break;
  case 'refresh':
    client.refresh();
    break;
  case 'talk':
    onClientTalk(client, msg);
    break;
  case 'enter':
    onClientEnter(client, msg);
    break;
  case 'setRoom':
    onClientSetRoom(client, msg);
    break;
  case 'leave':
    if (!client.place) return;
    client.leave();
    break;
  case 'ready':
    if (!client.place) return;
    if (!GUEST_PERMISSION.ready && client.guest) return;
    client.toggle();
    break;
  case 'start':
    onClientStart(client);
    break;
  case 'practice':
    onClientPractice(client, msg);
    break;
  case 'invite':
    onClientInvite(client, msg);
    break;
  case 'inviteRes':
    onClientInviteRes(client, msg);
    break;
  case 'form':
    if (!msg.mode) return;
    if (!ROOM[client.place]) return;
    if (!ENABLED_FORM.includes(msg.mode)) return;
    client.setForm(msg.mode);
    break;
  case 'team':
    onClientTeam(client, msg);
    break;
  case 'kick':
    onClientKick(client, msg);
    break;
  case 'kickVote':
    onClientKickVote(client, msg);
    break;
  case 'handover':
    onClientHandover(client, msg);
    break;
  case 'wp':
    onClientWp(client, msg);
    break;
  case 'setAI':
    onClientSetAI(client, msg);
    break;
  default:
    break;
  }
};