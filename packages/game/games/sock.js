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

const LANG_STATS = { 'ko': {
	reg: /^[가-힣]{2,5}$/,
	add: [ 'type', Const.KOR_GROUP ],
	len: 64,
	min: 5
}, 'en': {
	reg: /^[a-z]{4,10}$/,
	len: 100,
	min: 10
}};

function getBoard(words, len){
	var str = words.join("").split("");
	var sl = str.length;

	while(sl++ < len) str.push("　");

	return str.sort(function(){ return Math.random() < 0.5; }).join("");
}

module.exports = class {
	constructor(_DB, _DIC, _ROOM) {
		this.DB = _DB;
		this.DIC = _DIC;
		this.ROOM = _ROOM;
	}

	getTitle() {
		var R = new Lizard.Tail();

		// FIXME: 0.5초의 성능지연
		setTimeout(function(){
			R.go("①②③④⑤⑥⑦⑧⑨⑩");
		}, 500);
		return R;
	}

	roundReady() {
		var words = [];
		var conf = LANG_STATS[this.ROOM.rule.lang];
		var len = conf.len;
		var i, w;

		clearTimeout(this.ROOM.game.turnTimer);
		this.ROOM.game.round++;
		this.ROOM.game.roundTime = this.ROOM.time * 1000;
		if(this.ROOM.game.round <= this.ROOM.round){
			this.DB.kkutu[this.ROOM.rule.lang].find([ '_id', conf.reg ], [ 'hit', { $gte: 1 } ], conf.add).limit(1234).on(($docs) => {
				$docs.sort(function(a, b){ return Math.random() < 0.5; });
				while(w = $docs.shift()){
					words.push(w._id);
					i = w._id.length;
					if((len -= i) <= conf.min) break;
				}
				words.sort(function(a, b){ return b.length - a.length; });
				this.ROOM.game.words = [];
				this.ROOM.game.board = getBoard(words, conf.len);
				this.ROOM.byMaster('roundReady', {
					round: this.ROOM.game.round,
					board: this.ROOM.game.board
				}, true);
				this.ROOM.game.turnTimer = setTimeout(this.ROOM.turnStart, 2400);
			});
		}else{
			this.ROOM.roundEnd();
		}
	}

	turnStart() {
		this.ROOM.game.late = false;
		this.ROOM.game.roundAt = (new Date()).getTime();
		this.ROOM.game.qTimer = setTimeout(this.ROOM.turnEnd, this.ROOM.game.roundTime);
		this.ROOM.byMaster('turnStart', {
			roundTime: this.ROOM.game.roundTime
		}, true);
	}

	turnEnd() {
		this.ROOM.game.late = true;

		this.ROOM.byMaster('turnEnd', {});
		this.ROOM.game._rrt = setTimeout(this.ROOM.roundReady, 3000);
	}

	submit(client, text) {
		var play = (this.ROOM.game.seq ? this.ROOM.game.seq.includes(client.id) : false) || client.robot;
		var score, i;

		if(!this.ROOM.game.words) return;
		if(!text) return;

		if(!play) return client.chat(text);
		if(text.length < (this.ROOM.opts.no2 ? 3 : 2)){
			return client.chat(text);
		}
		if(this.ROOM.game.words.indexOf(text) != -1){
			return client.chat(text);
		}
		this.DB.kkutu[this.ROOM.rule.lang].findOne([ '_id', text ]).limit([ '_id', true ]).on(($doc) => {
			if(!this.ROOM.game.board) return;

			var newBoard = this.ROOM.game.board;
			var _newBoard = newBoard;
			var wl;

			if($doc){
				wl = $doc._id.split('');
				for(i in wl){
					newBoard = newBoard.replace(wl[i], "");
					if(newBoard == _newBoard){ // 그런 글자가 없다.
						client.chat(text);
						return;
					}
					_newBoard = newBoard;
				}
				// 성공
				score = this.ROOM.getScore(text);
				this.ROOM.game.words.push(text);
				this.ROOM.game.board = newBoard;
				client.game.score += score;
				client.publish('turnEnd', {
					target: client.id,
					value: text,
					score: score
				}, true);
				client.invokeWordPiece(text, 1.1);
			}else{
				client.chat(text);
			}
		});
	}

	getScore(text) {
		return Math.round(Math.pow(text.length - 1, 1.6) * 8);
	}
}