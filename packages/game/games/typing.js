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

var TYL = require('./typing_const');
var Lizard = require('kkutu-common/lizard');

var LIST_LENGTH = 200;
var DOUBLE_VOWELS = [ 9, 10, 11, 14, 15, 16, 19 ];
var DOUBLE_TAILS = [ 3, 5, 6, 9, 10, 11, 12, 13, 14, 15, 18 ];

module.exports = class {
	constructor(_DB, _DIC, _ROOM) {
		this.DB = _DB;
		this.DIC = _DIC;
		this.ROOM = _ROOM;
	}

	traverse(func) {
		var i, o;

		for(i in this.ROOM.game.seq){
			if(!(o = this.DIC[this.ROOM.game.seq[i]])) continue;
			if(!o.game) continue;
			func(o);
		}
	}

	getTitle() {
		var R = new Lizard.Tail();
		var my = this;
		var i, j;

		if(this.ROOM.opts.proverb) pick(TYL.PROVERBS[this.ROOM.rule.lang]);
		else this.DB.kkutu[this.ROOM.rule.lang].find([ '_id', /^.{2,5}$/ ], [ 'hit', { $gte: 1 } ]).limit(416).on(function($res){
			pick($res.map(function(item){ return item._id; }));
		});
		function pick(list){
			var data = [];
			var len = list.length;
			var arr;

			for(i=0; i<my.ROOM.round; i++){
				arr = [];
				for(j=0; j<LIST_LENGTH; j++){
					arr.push(list[Math.floor(Math.random() * len)]);
				}
				data.push(arr);
			}
			my.ROOM.game.lists = data;
			R.go("①②③④⑤⑥⑦⑧⑨⑩");
		}
		this.traverse((o) => {
			o.game.spl = 0;
		});
		return R;
	}

	roundReady() {
		var scores = {};

		if(!this.ROOM.game.lists) return;

		this.ROOM.game.round++;
		this.ROOM.game.roundTime = this.ROOM.time * 1000;
		if(this.ROOM.game.round <= this.ROOM.round){
			this.ROOM.game.clist = this.ROOM.game.lists.shift();
			this.ROOM.byMaster('roundReady', {
				round: this.ROOM.game.round,
				list: this.ROOM.game.clist
			}, true);
			setTimeout(this.ROOM.turnStart, 2400);
		}else{
			this.traverse((o) => {
				scores[o.id] = Math.round(o.game.spl / this.ROOM.round);
			});
			this.ROOM.roundEnd({ scores: scores });
		}
	}

	turnStart() {
		this.ROOM.game.late = false;
		this.traverse((o) => {
			o.game.miss = 0;
			o.game.index = 0;
			o.game.semi = 0;
		});
		this.ROOM.game.qTimer = setTimeout(this.ROOM.turnEnd, this.ROOM.game.roundTime);
		this.ROOM.byMaster('turnStart', { roundTime: this.ROOM.game.roundTime }, true);
	}

	turnEnd() {
		var spl = {};
		var sv;

		this.ROOM.game.late = true;
		this.traverse((o) => {
			sv = (o.game.semi + o.game.index - o.game.miss) / this.ROOM.time * 60;
			spl[o.id] = Math.round(sv);
			o.game.spl += sv;
		});
		this.ROOM.byMaster('turnEnd', {
			ok: false,
			speed: spl
		});
		this.ROOM.game._rrt = setTimeout(this.ROOM.roundReady, (this.ROOM.game.round == this.ROOM.round) ? 3000 : 10000);
	}

	submit(client, text) {
		var score;

		if(!client.game) return;

		if(this.ROOM.game.clist[client.game.index] == text){
			score = this.ROOM.getScore(text);

			client.game.semi += score;
			client.game.score += score;
			client.publish('turnEnd', {
				target: client.id,
				ok: true,
				value: text,
				score: score
			}, true);
			client.invokeWordPiece(text, 0.5);
		}else{
			client.game.miss++;
			client.send('turnEnd', { error: true });
		}
		if(!this.ROOM.game.clist[++client.game.index]) client.game.index = 0;
	}

	getScore(text) {
		var i, len = text.length;
		var r = 0, s, t;

		switch(this.ROOM.rule.lang){
			case 'ko':
				for(i=0; i<len; i++){
					s = text.charCodeAt(i);
					if(s < 44032){
						r++;
					}else{
						t = (s - 44032) % 28;
						r += t ? 3 : 2;
						if(DOUBLE_VOWELS.includes(Math.floor(((text.charCodeAt(i) - 44032) % 588) / 28))) r++;
						if(DOUBLE_TAILS.includes(t)) r++;
					}
				}
				return r;
			case 'en': return len;
			default: return r;
		}
	}
}