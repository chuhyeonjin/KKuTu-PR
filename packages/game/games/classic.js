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
var Lizard = require('kkutu-common/lizard');

const ROBOT_START_DELAY = [ 1200, 800, 400, 200, 0 ];
const ROBOT_TYPE_COEF = [ 1250, 750, 500, 250, 0 ];
const ROBOT_THINK_COEF = [ 4, 2, 1, 0, 0 ];
const ROBOT_HIT_LIMIT = [ 8, 4, 2, 1, 0 ];
const ROBOT_LENGTH_LIMIT = [ 3, 4, 9, 99, 99 ];
const RIEUL_TO_NIEUN = [4449, 4450, 4457, 4460, 4462, 4467];
const RIEUL_TO_IEUNG = [4451, 4455, 4456, 4461, 4466, 4469];
const NIEUN_TO_IEUNG = [4455, 4461, 4466, 4469];

module.exports = class {
	constructor(_DB, _DIC, _ROOM) {
		this.DB = _DB;
		this.DIC = _DIC;
		this.ROOM = _ROOM;
	}

	getTitle() {
		var R = new Lizard.Tail();
		var l = this.ROOM.rule;
		var EXAMPLE;
		var eng, ja;

		if(!l){
			R.go("undefinedd");
			return R;
		}
		if(!l.lang){
			R.go("undefinedd");
			return R;
		}
		EXAMPLE = Const.EXAMPLE_TITLE[l.lang];
		this.ROOM.game.dic = {};

		switch(Const.GAME_TYPE[this.ROOM.mode]){
			case 'EKT':
			case 'ESH':
				eng = "^" + String.fromCharCode(97 + Math.floor(Math.random() * 26));
				break;
			case 'KKT':
				this.ROOM.game.wordLength = 3;
			case 'KSH':
				ja = 44032 + 588 * Math.floor(Math.random() * 18);
				eng = "^[\\u" + ja.toString(16) + "-\\u" + (ja + 587).toString(16) + "]";
				break;
			case 'KAP':
				ja = 44032 + 588 * Math.floor(Math.random() * 18);
				eng = "[\\u" + ja.toString(16) + "-\\u" + (ja + 587).toString(16) + "]$";
				break;
		}

		var my = this;
		function tryTitle(h){
			if(h > 50){
				R.go(EXAMPLE);
				return;
			}
			my.DB.kkutu[l.lang].find(
				[ '_id', new RegExp(eng + ".{" + Math.max(1, my.ROOM.round - 1) + "}$") ],
				// [ 'hit', { '$lte': h } ],
				(l.lang == "ko") ? [ 'type', Const.KOR_GROUP ] : [ '_id', Const.ENG_ID ]
				// '$where', eng+"this._id.length == " + Math.max(2, my.round) + " && this.hit <= " + h
			).limit(20).on(function($md){
				var list;

				if($md.length){
					list = shuffle($md);
					checkTitle(list.shift()._id).then(onChecked);

					function onChecked(v){
						if(v) R.go(v);
						else if(list.length) checkTitle(list.shift()._id).then(onChecked);
						else R.go(EXAMPLE);
					}
				}else{
					tryTitle(h + 10);
				}
			});
		}
		function checkTitle(title){
			var R = new Lizard.Tail();
			var i, list = [];
			var len;

			/* ���ϰ� �ʹ� �ɸ��ٸ� �ּ��� Ǯ��.
            R.go(true);
            return R;
            */
			if(title == null){
				R.go(EXAMPLE);
			}else{
				len = title.length;
				for(i=0; i<len; i++) list.push(getAuto.call(my, title[i], getSubChar.call(my, title[i]), 1));

				Lizard.all(list).then(function(res){
					for(i in res) if(!res[i]) return R.go(EXAMPLE);

					return R.go(title);
				});
			}
			return R;
		}
		tryTitle(10);

		return R;
	}

	roundReady() {
		if(!this.ROOM.game.title) return;

		clearTimeout(this.ROOM.game.turnTimer);
		this.ROOM.game.round++;
		this.ROOM.game.roundTime = this.ROOM.time * 1000;
		if(this.ROOM.game.round <= this.ROOM.round){
			this.ROOM.game.char = this.ROOM.game.title[this.ROOM.game.round - 1];
			this.ROOM.game.subChar = getSubChar.call(this, this.ROOM.game.char);
			this.ROOM.game.chain = [];
			if(this.ROOM.opts.mission) this.ROOM.game.mission = getMission(this.ROOM.rule.lang);
			if(this.ROOM.opts.sami) this.ROOM.game.wordLength = 2;

			this.ROOM.byMaster('roundReady', {
				round: this.ROOM.game.round,
				char: this.ROOM.game.char,
				subChar: this.ROOM.game.subChar,
				mission: this.ROOM.game.mission
			}, true);
			this.ROOM.game.turnTimer = setTimeout(() => { this.ROOM.turnStart(); }, 2400);
		}else{
			this.ROOM.roundEnd();
		}
	}

	turnStart(force) {
		var speed;
		var si;

		if(!this.ROOM.game.chain) return;
		this.ROOM.game.roundTime = Math.min(this.ROOM.game.roundTime, Math.max(10000, 150000 - this.ROOM.game.chain.length * 1500));
		speed = this.ROOM.getTurnSpeed(this.ROOM.game.roundTime);
		clearTimeout(this.ROOM.game.turnTimer);
		clearTimeout(this.ROOM.game.robotTimer);
		this.ROOM.game.late = false;
		this.ROOM.game.turnTime = 15000 - 1400 * speed;
		this.ROOM.game.turnAt = (new Date()).getTime();
		if(this.ROOM.opts.sami) this.ROOM.game.wordLength = (this.ROOM.game.wordLength == 3) ? 2 : 3;

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
		if(si = this.ROOM.game.seq[this.ROOM.game.turn]) if(si.robot){
			si._done = [];
			this.ROOM.readyRobot(si);
		}
	}

	turnEnd() {
		var target;
		var score;

		if(!this.ROOM.game.seq) return;
		target = this.DIC[this.ROOM.game.seq[this.ROOM.game.turn]] || this.ROOM.game.seq[this.ROOM.game.turn];

		if(this.ROOM.game.loading){
			this.ROOM.game.turnTimer = setTimeout(() => { this.ROOM.turnEnd(); }, 100);
			return;
		}
		this.ROOM.game.late = true;
		if(target) if(target.game){
			score = Const.getPenalty(this.ROOM.game.chain, target.game.score);
			target.game.score += score;
		}

		var my = this;
		getAuto.call(this, this.ROOM.game.char, this.ROOM.game.subChar, 0).then(function(w){
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
		var score, l, t;
		var tv = (new Date()).getTime();
		var mgt = this.ROOM.game.seq[this.ROOM.game.turn];

		if(!mgt) return;
		if(!mgt.robot) if(mgt != client.id) return;
		if(!this.ROOM.game.char) return;

		const my = this;
		if(!isChainable(text, this.ROOM.mode, this.ROOM.game.char, this.ROOM.game.subChar)) return client.chat(text);
		if(this.ROOM.game.chain.indexOf(text) != -1) return client.publish('turnError', { code: 409, value: text }, true);

		l = this.ROOM.rule.lang;
		this.ROOM.game.loading = true;

		function onDB($doc){
			if(!my.ROOM.game.chain) return;
			var preChar = getChar.call(my, text);
			var preSubChar = getSubChar.call(my, preChar);
			var firstMove = my.ROOM.game.chain.length < 1;

			function preApproved(){
				function approved(){
					if(my.ROOM.game.late) return;
					if(!my.ROOM.game.chain) return;
					if(!my.ROOM.game.dic) return;

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
					if(my.ROOM.game.mission === true){
						my.ROOM.game.mission = getMission(my.ROOM.rule.lang);
					}
					setTimeout(() => { my.ROOM.turnNext(); }, my.ROOM.game.turnTime / 6);
					if(!client.robot){
						client.invokeWordPiece(text, 1);
						my.DB.kkutu[l].update([ '_id', text ]).set([ 'hit', $doc.hit + 1 ]).on();
					}
				}
				if(firstMove || my.ROOM.opts.manner) getAuto.call(my, preChar, preSubChar, 1).then(function(w){
					if(w) approved();
					else{
						my.ROOM.game.loading = false;
						client.publish('turnError', { code: firstMove ? 402 : 403, value: text }, true);
						if(client.robot){
							my.ROOM.readyRobot(client);
						}
					}
				});
				else approved();
			}
			function denied(code){
				my.ROOM.game.loading = false;
				client.publish('turnError', { code: code || 404, value: text }, true);
			}
			if($doc){
				if(!my.ROOM.opts.injeong && ($doc.flag & Const.KOR_FLAG.INJEONG)) denied();
				else if(my.ROOM.opts.strict && (!$doc.type.match(Const.KOR_STRICT) || $doc.flag >= 4)) denied(406);
				else if(my.ROOM.opts.loanword && ($doc.flag & Const.KOR_FLAG.LOANWORD)) denied(405);
				else preApproved();
			}else{
				denied();
			}
		}
		function isChainable(){
			var type = Const.GAME_TYPE[my.ROOM.mode];
			var char = my.ROOM.game.char, subChar = my.ROOM.game.subChar;
			var l = char.length;

			if(!text) return false;
			if(text.length <= l) return false;
			if(my.ROOM.game.wordLength && text.length != my.ROOM.game.wordLength) return false;
			if(type == "KAP") return (text.slice(-1) == char) || (text.slice(-1) == subChar);
			switch(l){
				case 1: return (text[0] == char) || (text[0] == subChar);
				case 2: return (text.substr(0, 2) == char);
				case 3: return (text.substr(0, 3) == char) || (text.substr(0, 2) == char.slice(1));
				default: return false;
			}
		}
		my.DB.kkutu[l].findOne([ '_id', text ],
			(l == "ko") ? [ 'type', Const.KOR_GROUP ] : [ '_id', Const.ENG_ID ]
		).on(onDB);
	}

	getScore(text, delay, ignoreMission) {
		var tr = 1 - delay / this.ROOM.game.turnTime;
		var score, arr;

		if(!text || !this.ROOM.game.chain || !this.ROOM.game.dic) return 0;
		score = Const.getPreScore(text, this.ROOM.game.chain, tr);

		if(this.ROOM.game.dic[text]) score *= 15 / (this.ROOM.game.dic[text] + 15);
		if(!ignoreMission) if(arr = text.match(new RegExp(this.ROOM.game.mission, "g"))){
			score += score * 0.5 * arr.length;
			this.ROOM.game.mission = true;
		}
		return Math.round(score);
	}

	readyRobot(robot) {
		var level = robot.level;
		var delay = ROBOT_START_DELAY[level];
		var ended = {};
		var w, text, i;
		var lmax;
		var isRev = Const.GAME_TYPE[this.ROOM.mode] == "KAP";

		var my = this;

		getAuto.call(this, this.ROOM.game.char, this.ROOM.game.subChar, 2).then(function(list){
			if(list.length){
				list.sort(function(a, b){ return b.hit - a.hit; });
				if(ROBOT_HIT_LIMIT[level] > list[0].hit) denied();
				else{
					if(level >= 3 && !robot._done.length){
						if(Math.random() < 0.5) list.sort(function(a, b){ return b._id.length - a._id.length; });
						if(list[0]._id.length < 8 && my.ROOM.game.turnTime >= 2300){
							for(i in list){
								w = list[i]._id.charAt(isRev ? 0 : (list[i]._id.length - 1));
								if(!ended.hasOwnProperty(w)) ended[w] = [];
								ended[w].push(list[i]);
							}
							getWishList(Object.keys(ended)).then(function(key){
								var v = ended[key];

								if(!v) denied();
								else pickList(v);
							});
						}else{
							pickList(list);
						}
					}else pickList(list);
				}
			}else denied();
		});
		function denied(){
			text = isRev ? `T.T ...${my.ROOM.game.char}` : `${my.ROOM.game.char}... T.T`;
			after();
		}
		function pickList(list){
			if(list) do{
				if(!(w = list.shift())) break;
			}while(w._id.length > ROBOT_LENGTH_LIMIT[level] || robot._done.includes(w._id));
			if(w){
				text = w._id;
				delay += 500 * ROBOT_THINK_COEF[level] * Math.random() / Math.log(1.1 + w.hit);
				after();
			}else denied();
		}
		function after(){
			delay += text.length * ROBOT_TYPE_COEF[level];
			robot._done.push(text);
			setTimeout(() => { my.ROOM.turnRobot(robot, text); }, delay);
		}
		function getWishList(list){
			var R = new Lizard.Tail();
			var wz = [];
			var res;

			for(i in list) wz.push(getWish(list[i]));
			Lizard.all(wz).then(function($res){
				if(!my.ROOM.game.chain) return;
				$res.sort(function(a, b){ return a.length - b.length; });

				if(my.ROOM.opts.manner || !my.ROOM.game.chain.length){
					while(res = $res.shift()) if(res.length) break;
				}else res = $res.shift();
				R.go(res ? res.char : null);
			});
			return R;
		}
		function getWish(char){
			var R = new Lizard.Tail();

			my.DB.kkutu[my.ROOM.rule.lang].find([ '_id', new RegExp(isRev ? `.${char}$` : `^${char}.`) ]).limit(10).on(function($res){
				R.go({ char: char, length: $res.length });
			});
			return R;
		}
	}
}

function getMission(l){
	var arr = (l == "ko") ? Const.MISSION_ko : Const.MISSION_en;
	
	if(!arr) return "-";
	return arr[Math.floor(Math.random() * arr.length)];
}
function getAuto(char, subc, type){
	/* type
		0 ������ �ܾ� �ϳ�
		1 ���� ����
		2 �ܾ� ���
	*/
	var R = new Lizard.Tail();
	var gameType = Const.GAME_TYPE[this.ROOM.mode];
	var adv, adc;
	var key = gameType + "_" + keyByOptions(this.ROOM.opts);
	var MAN = this.DB.kkutu_manner[this.ROOM.rule.lang];
	var bool = type == 1;
	
	adc = char + (subc ? ("|"+subc) : "");
	switch(gameType){
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
			adv = `^(${adc}).{${this.ROOM.game.wordLength-1}}$`;
			break;
		case 'KAP':
			adv = `.(${adc})$`;
			break;
	}
	if(!char){
		console.log(`Undefined char detected! key=${key} type=${type} adc=${adc}`);
	}
	MAN.findOne([ '_id', char || "��" ]).on(function($mn){
		if($mn && bool){
			if($mn[key] === null) produce();
			else R.go($mn[key]);
		}else{
			produce();
		}
	});
	var my = this;
	function produce(){
		var aqs = [[ '_id', new RegExp(adv) ]];
		var aft;
		var lst;
		
		if(!my.ROOM.opts.injeong) aqs.push([ 'flag', { '$nand': Const.KOR_FLAG.INJEONG } ]);
		if(my.ROOM.rule.lang == "ko"){
			if(my.ROOM.opts.loanword) aqs.push([ 'flag', { '$nand': Const.KOR_FLAG.LOANWORD } ]);
			if(my.ROOM.opts.strict) aqs.push([ 'type', Const.KOR_STRICT ], [ 'flag', { $lte: 3 } ]);
			else aqs.push([ 'type', Const.KOR_GROUP ]);
		}else{
			aqs.push([ '_id', Const.ENG_ID ]);
		}
		switch(type){
			case 0:
			default:
				aft = function($md){
					R.go($md[Math.floor(Math.random() * $md.length)]);
				};
				break;
			case 1:
				aft = function($md){
					R.go($md.length ? true : false);
				};
				break;
			case 2:
				aft = function($md){
					R.go($md);
				};
				break;
		}
		my.DB.kkutu[my.ROOM.rule.lang].find.apply(this, aqs).limit(bool ? 1 : 123).on(function($md){
			forManner($md);
			if(my.ROOM.game.chain) aft($md.filter(function(item){ return !my.ROOM.game.chain.includes(item); }));
			else aft($md);
		});
		function forManner(list){
			lst = list;
			MAN.upsert([ '_id', char ]).set([ key, lst.length ? true : false ]).on(null, null, onFail);
		}
		function onFail(){
			MAN.createColumn(key, "boolean").on(function(){
				forManner(lst);
			});
		}
	}
	return R;
}
function keyByOptions(opts){
	var arr = [];
	
	if(opts.injeong) arr.push('X');
	if(opts.loanword) arr.push('L');
	if(opts.strict) arr.push('S');
	return arr.join('');
}
function shuffle(arr){
	var i, r = [];
	
	for(i in arr) r.push(arr[i]);
	r.sort(function(a, b){ return Math.random() - 0.5; });
	
	return r;
}
function getChar(text){
	switch(Const.GAME_TYPE[this.ROOM.mode]){
		case 'EKT': return text.slice(text.length - 3);
		case 'ESH':
		case 'KKT':
		case 'KSH': return text.slice(-1);
		case 'KAP': return text.charAt(0);
	}
};
function getSubChar(char){
	var r;
	var c = char.charCodeAt();
	var k;
	var ca, cb, cc;
	
	switch(Const.GAME_TYPE[this.ROOM.mode]){
		case "EKT":
			if(char.length > 2) r = char.slice(1);
			break;
		case "KKT": case "KSH": case "KAP":
			k = c - 0xAC00;
			if(k < 0 || k > 11171) break;
			ca = [ Math.floor(k/28/21), Math.floor(k/28)%21, k%28 ];
			cb = [ ca[0] + 0x1100, ca[1] + 0x1161, ca[2] + 0x11A7 ];
			cc = false;
			if(cb[0] == 4357){ // ������ ��, ��
				cc = true;
				if(RIEUL_TO_NIEUN.includes(cb[1])) cb[0] = 4354;
				else if(RIEUL_TO_IEUNG.includes(cb[1])) cb[0] = 4363;
				else cc = false;
			}else if(cb[0] == 4354){ // ������ ��
				if(NIEUN_TO_IEUNG.indexOf(cb[1]) != -1){
					cb[0] = 4363;
					cc = true;
				}
			}
			if(cc){
				cb[0] -= 0x1100; cb[1] -= 0x1161; cb[2] -= 0x11A7;
				r = String.fromCharCode(((cb[0] * 21) + cb[1]) * 28 + cb[2] + 0xAC00);
			}
			break;
		case "ESH": default:
			break;
	}
	return r;
}