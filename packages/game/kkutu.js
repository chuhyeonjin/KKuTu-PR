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

const Cluster = require('cluster');

var GUEST_PERMISSION;
var DB;
var SHOP;
var DIC;
var ROOM;
var _rid;
function getRid() { return _rid; }
function setRid(rid) { _rid = rid; }
// var Rule;
var guestProfiles = [];
var CHAN;


const NUM_SLAVES = 4;

function getNIGHT() { return exports.NIGHT; }
exports.NIGHT = false;
exports.init = function(_DB, _DIC, _ROOM, _GUEST_PERMISSION, _CHAN) {
  DB = _DB;
  DIC = _DIC;
  ROOM = _ROOM;
  GUEST_PERMISSION = _GUEST_PERMISSION;
  CHAN = _CHAN;
  _rid = 100;
  DB.kkutu_shop.find().on(function($shop) {
    SHOP = {};
		
    $shop.forEach(function(item) {
      SHOP[item._id] = item;
    });
  });

  // Rule = {};
  // for(const i in Const.RULE){
  // 	const k = Const.RULE[i].rule;
  // 	const gameMode = require(`./games/${k.toLowerCase()}`);
  // 	Rule[k] = new gameMode(DB, DIC);
  // }
};

exports.getUserList = function() {
  var i; var res = {};
	
  for (i in DIC) {
    res[i] = DIC[i].getData();
  }
	
  return res;
};
exports.getRoomList = function() {
  var i; var res = {};
	
  for (i in ROOM) {
    res[i] = ROOM[i].getData();
  }
	
  return res;
};
exports.narrate = function(list, type, data) {
  list.forEach(function(v) {
    if (DIC[v]) DIC[v].send(type, data);
  });
};
exports.publish = function(type, data, _room) {
  var i;
	
  if (Cluster.isMaster) {
    for (i in DIC) {
      DIC[i].send(type, data);
    }
  } else if (Cluster.isWorker) {
    if (type == 'room') process.send({ type: 'room-publish', data: data, password: _room });
    else {
      for (i in DIC) {
        DIC[i].send(type, data);
      }
    }
  }
};

const _Robot = require('./kkutu/robot');
exports.Robot = class extends _Robot {
  constructor(target, place, level) {
    super(target, place, level, DIC);
  }
};

const _Data = require('./kkutu/data');
exports.Data = class extends _Data {
  constructor(data) {
    super(data);
  }
};

const _WebServer = require('./kkutu/webServer');
exports.WebServer = class extends _WebServer {
  constructor(socket) {
    super(socket, DIC, exports.narrate);
  }
};

const _Client = require('./kkutu/client');
const that = this;
exports.Client = class extends _Client {
  constructor(socket, profile, sid) {
    super(socket, profile, sid, CHAN, ROOM, guestProfiles, DIC, SHOP, DB, GUEST_PERMISSION, getRid, setRid, exports.publish, exports.onClientClosed, getNIGHT, that.onClientMessage);
  }
};

const _Room = require('./kkutu/room');
exports.Room = class extends _Room {
  constructor(room, channel) {
    super(room, channel, _rid, DIC, ROOM, DB, exports.publish);
  }
};