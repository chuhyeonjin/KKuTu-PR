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

var ROBOT_CATCH_RATE = [ 0.1, 0.3, 0.5, 0.7, 0.99 ];
var ROBOT_TYPE_COEF = [ 2000, 1200, 800, 300, 0 ];
var robotTimers = {};

module.exports = class {
	constructor(_DB, _DIC, _ROOM) {
		this.DB = _DB;
		this.DIC = _DIC;
		this.ROOM = _ROOM;
	}

	getTitle() {
		var R = new Lizard.Tail();

		this.ROOM.game.done = [];
		setTimeout(function(){
			R.go("①②③④⑤⑥⑦⑧⑨⑩");
		}, 500);
		return R;
	}

	roundReady() {
		var ijl = this.ROOM.opts.injpick.length;

		clearTimeout(this.ROOM.game.qTimer);
		clearTimeout(this.ROOM.game.hintTimer);
		clearTimeout(this.ROOM.game.hintTimer2);
		this.ROOM.game.themeBonus = 0.3 * Math.log(0.6 * ijl + 1);
		this.ROOM.game.winner = [];
		this.ROOM.game.giveup = [];
		this.ROOM.game.round++;
		this.ROOM.game.roundTime = this.ROOM.time * 1000;
		if(this.ROOM.game.round <= this.ROOM.round){
			this.ROOM.game.theme = this.ROOM.opts.injpick[Math.floor(Math.random() * ijl)];
			getAnswer.call(this, this.ROOM.game.theme).then(($ans) => {
				if(!this.ROOM.game.done) return;

				// $ans가 null이면 골치아프다...
				this.ROOM.game.late = false;
				this.ROOM.game.answer = $ans || {};
				this.ROOM.game.done.push($ans._id);
				$ans.mean = ($ans.mean.length > 20) ? $ans.mean : getConsonants($ans._id, Math.round($ans._id.length / 2));
				this.ROOM.game.hint = getHint($ans);
				this.ROOM.byMaster('roundReady', {
					round: this.ROOM.game.round,
					theme: this.ROOM.game.theme
				}, true);
				setTimeout(this.ROOM.turnStart, 2400);
			});
		}else{
			this.ROOM.roundEnd();
		}
	}

	turnStart() {
		var i;

		if(!this.ROOM.game.answer) return;

		this.ROOM.game.conso = getConsonants(this.ROOM.game.answer._id, 1);
		this.ROOM.game.roundAt = (new Date()).getTime();
		this.ROOM.game.meaned = 0;
		this.ROOM.game.primary = 0;
		this.ROOM.game.qTimer = setTimeout(this.ROOM.turnEnd, this.ROOM.game.roundTime);
		this.ROOM.game.hintTimer = setTimeout(() => { turnHint.call(this); }, this.ROOM.game.roundTime * 0.333);
		this.ROOM.game.hintTimer2 = setTimeout(() => { turnHint.call(this); }, this.ROOM.game.roundTime * 0.667);
		this.ROOM.byMaster('turnStart', {
			char: this.ROOM.game.conso,
			roundTime: this.ROOM.game.roundTime
		}, true);

		for(i in this.ROOM.game.robots){
			this.ROOM.readyRobot(this.ROOM.game.robots[i]);
		}
	}

	turnEnd() {
		if(this.ROOM.game.answer){
			this.ROOM.game.late = true;
			this.ROOM.byMaster('turnEnd', {
				answer: this.ROOM.game.answer ? this.ROOM.game.answer._id : ""
			});
		}
		this.ROOM.game._rrt = setTimeout(this.ROOM.roundReady, 2500);
	}

	submit(client, text) {
		var score, t, i;
		var $ans = this.ROOM.game.answer;
		var now = (new Date()).getTime();
		var play = (this.ROOM.game.seq ? this.ROOM.game.seq.includes(client.id) : false) || client.robot;
		var gu = this.ROOM.game.giveup ? this.ROOM.game.giveup.includes(client.id) : true;

		if(!this.ROOM.game.winner) return;
		if(this.ROOM.game.winner.indexOf(client.id) == -1
			&& text == $ans._id
			&& play && !gu
		){
			t = now - this.ROOM.game.roundAt;
			if(this.ROOM.game.primary == 0) if(this.ROOM.game.roundTime - t > 10000){ // 가장 먼저 맞힌 시점에서 10초 이내에 맞히면 점수 약간 획득
				clearTimeout(this.ROOM.game.qTimer);
				this.ROOM.game.qTimer = setTimeout(this.ROOM.turnEnd, 10000);
				for(i in this.ROOM.game.robots){
					if(this.ROOM.game.roundTime > this.ROOM.game.robots[i]._delay){
						clearTimeout(this.ROOM.game.robots[i]._timer);
						if(client != this.ROOM.game.robots[i]) if(Math.random() < ROBOT_CATCH_RATE[this.ROOM.game.robots[i].level])
							this.ROOM.game.robots[i]._timer = setTimeout(this.ROOM.turnRobot, ROBOT_TYPE_COEF[this.ROOM.game.robots[i].level], this.ROOM.game.robots[i], text);
					}
				}
			}
			clearTimeout(this.ROOM.game.hintTimer);
			score = this.ROOM.getScore(text, t);
			this.ROOM.game.primary++;
			this.ROOM.game.winner.push(client.id);
			client.game.score += score;
			client.publish('turnEnd', {
				target: client.id,
				ok: true,
				value: text,
				score: score,
				bonus: 0
			}, true);
			client.invokeWordPiece(text, 0.9);
			while(this.ROOM.game.meaned < this.ROOM.game.hint.length){
				turnHint.call(this);
			}
		}else if(play && !gu && (text == "gg" || text == "ㅈㅈ")){
			this.ROOM.game.giveup.push(client.id);
			client.publish('turnEnd', {
				target: client.id,
				giveup: true
			}, true);
		}else{
			client.chat(text);
		}
		if(play) if(this.ROOM.game.primary + this.ROOM.game.giveup.length >= this.ROOM.game.seq.length){
			clearTimeout(this.ROOM.game.hintTimer);
			clearTimeout(this.ROOM.game.hintTimer2);
			clearTimeout(this.ROOM.game.qTimer);
			this.ROOM.turnEnd();
		}
	}

	getScore(text, delay) {
		var rank = this.ROOM.game.hum - this.ROOM.game.primary + 3;
		var tr = 1 - delay / this.ROOM.game.roundTime;
		var score = 6 * Math.pow(rank, 1.4) * ( 0.5 + 0.5 * tr );

		return Math.round(score * this.ROOM.game.themeBonus);
	}

	readyRobot(robot) {
		var level = robot.level;
		var delay, text;
		var i;

		if(!this.ROOM.game.answer) return;
		clearTimeout(robot._timer);
		robot._delay = 99999999;
		for(i=0; i<2; i++){
			if(Math.random() < ROBOT_CATCH_RATE[level]){
				text = this.ROOM.game.answer._id;
				delay = this.ROOM.game.roundTime / 3 * i + text.length * ROBOT_TYPE_COEF[level];
				robot._timer = setTimeout(this.ROOM.turnRobot, delay, robot, text);
				robot._delay = delay;
				break;
			}else continue;
		}
	}
}
function turnHint(){
	this.ROOM.byMaster('turnHint', {
		hint: this.ROOM.game.hint[this.ROOM.game.meaned++]
	}, true);
}
function getConsonants(word, lucky){
	var R = "";
	var i, len = word.length;
	var c;
	var rv = [];
	
	lucky = lucky || 0;
	while(lucky > 0){
		c = Math.floor(Math.random() * len);
		if(rv.includes(c)) continue;
		rv.push(c);
		lucky--;
	}
	for(i=0; i<len; i++){
		c = word.charCodeAt(i) - 44032;
		
		if(c < 0 || rv.includes(i)){
			R += word.charAt(i);
			continue;
		}else c = Math.floor(c / 588);
		R += Const.INIT_SOUNDS[c];
	}
	return R;
}
function getHint($ans){
	var R = [];
	var h1 = $ans.mean.replace(new RegExp($ans._id, "g"), "★");
	var h2;
	
	R.push(h1);
	do{
		h2 = getConsonants($ans._id, Math.ceil($ans._id.length / 2));
	}while(h1 == h2);
	R.push(h2);
	
	return R;
}
function getAnswer(theme){
	var R = new Lizard.Tail();
	var args = [ [ '_id', { $nin: this.ROOM.game.done } ] ];

	args.push([ 'theme', new RegExp("(,|^)(" + theme + ")(,|$)") ]);
	args.push([ 'type', Const.KOR_GROUP ]);
	args.push([ 'flag', { $lte: 7 } ]);
	this.DB.kkutu['ko'].find.apply(this.ROOM, args).on(function($res){
		if(!$res) return R.go(null);
		var pick;
		var len = $res.length;

		if(!len) return R.go(null);
		do{
			pick = Math.floor(Math.random() * len);
			if($res[pick]._id.length >= 2) if($res[pick].type == "INJEONG" || $res[pick].mean.length >= 0){
				return R.go($res[pick]);
			}
			$res.splice(pick, 1);
			len--;
		}while(len > 0);
		R.go(null);
	});
	return R;
}