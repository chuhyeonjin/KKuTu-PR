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

var Lizard = require('kkutu-common/lizard');

module.exports = class {
	constructor(_DB, _DIC, _ROOM) {
		this.DB = _DB;
		this.DIC = _DIC;
		this.ROOM = _ROOM;
	}

	getTitle() {
		var R = new Lizard.Tail();
		var means = [];
		var mdb = [];

		this.ROOM.game.started = false;
		this.DB.kkutu_cw[this.ROOM.rule.lang].find().on(($box) => {
			var answers = {};
			var boards = [];
			var maps = [];
			var left = this.ROOM.round;
			var pick, pi, i, j;
			var mParser = [];

			while(left){
				pick = $box[pi = Math.floor(Math.random() * $box.length)];
				if(!pick) return;
				$box.splice(pi, 1);
				if(maps.includes(pick.map)) continue;
				means.push({});
				mdb.push({});
				maps.push(pick.map);
				boards.push(pick.data.split('|').map(function(item){ return item.split(','); }));
				left--;
			}
			for(i in boards){
				for(j in boards[i]){
					pi = boards[i][j];
					mParser.push(getMeaning(i, pi));
					answers[`${i},${pi[0]},${pi[1]},${pi[2]}`] = pi.pop();
				}
			}
			this.ROOM.game.numQ = mParser.length;
			Lizard.all(mParser).then(() => {
				this.ROOM.game.prisoners = {};
				this.ROOM.game.answers = answers;
				this.ROOM.game.boards = boards;
				this.ROOM.game.means = means;
				this.ROOM.game.mdb = mdb;
				R.go("①②③④⑤⑥⑦⑧⑨⑩");
			});
		});
		var my = this;
		function getMeaning(round, bItem){
			var R = new Lizard.Tail();
			var word = bItem[4];
			var x = Number(bItem[0]), y = Number(bItem[1]);

			my.DB.kkutu[my.ROOM.rule.lang].findOne([ '_id', word ]).on(function($doc){
				if(!$doc) return R.go(null);
				var rk = `${x},${y}`;
				var i, o;

				means[round][`${rk},${bItem[2]}`] = o = {
					count: 0,
					x: x, y: y,
					dir: Number(bItem[2]), len: Number(bItem[3]),
					type: $doc.type,
					theme: $doc.theme,
					mean: $doc.mean.replace(new RegExp(word.split('').map(function(w){ return w + "\\s?"; }).join(''), "g"), "★")
				};
				for(i=0; i<o.len; i++){
					rk = `${x},${y}`;
					if(!mdb[round][rk]) mdb[round][rk] = [];
					mdb[round][rk].push(o);
					if(o.dir) y++; else x++;
				}
				R.go(true);
			});
			return R;
		}
		return R;
	}

	roundReady() {
		if(!this.ROOM.game.started){
			this.ROOM.game.started = true;
			this.ROOM.game.roundTime = this.ROOM.time * 1000;
			this.ROOM.byMaster('roundReady', {
				seq: this.ROOM.game.seq
			}, true);
			setTimeout(this.ROOM.turnStart, 2400);
		}else{
			this.ROOM.roundEnd();
		}
	}

	turnStart() {
		this.ROOM.game.late = false;
		this.ROOM.game.roundAt = (new Date()).getTime();
		this.ROOM.game.qTimer = setTimeout(this.ROOM.turnEnd, this.ROOM.game.roundTime);
		this.ROOM.byMaster('turnStart', {
			boards: this.ROOM.game.boards,
			means: this.ROOM.game.means
		}, true);
	}

	turnEnd() {
		this.ROOM.game.late = true;
		this.ROOM.byMaster('turnEnd', {});
		this.ROOM.game._rrt = setTimeout(this.ROOM.roundReady, 2500);
	}

	submit(client, text, data) {
		var obj, score, mbjs, mbj, jx, jy, v;
		var play = (this.ROOM.game.seq ? this.ROOM.game.seq.includes(client.id) : false) || client.robot;
		var i, j, key;

		if(!this.ROOM.game.boards) return;
		if(!this.ROOM.game.answers) return;
		if(!this.ROOM.game.mdb) return;
		if(data && play){
			key = `${data[0]},${data[1]},${data[2]},${data[3]}`;
			obj = this.ROOM.game.answers[key];
			mbjs = this.ROOM.game.mdb[data[0]];
			if(!mbjs) return;
			if(obj && obj == text){
				score = text.length * 10;

				jx = Number(data[1]), jy = Number(data[2]);
				this.ROOM.game.prisoners[key] = text;
				this.ROOM.game.answers[key] = false;
				for(i=0; i<obj.length; i++){
					if(mbj = mbjs[`${jx},${jy}`]){
						for(j in mbj){
							key = [ data[0], mbj[j].x, mbj[j].y, mbj[j].dir ];
							if(++mbj[j].count == mbj[j].len){
								if(v = this.ROOM.game.answers[key.join(',')]) setTimeout(this.ROOM.submit, 1, client, v, key);
							}
						}
					}
					if(data[3] == "1") jy++; else jx++;
				}
				client.game.score += score;
				client.publish('turnEnd', {
					target: client.id,
					pos: data,
					value: text,
					score: score
				});
				client.invokeWordPiece(text, 1.2);
				if(--this.ROOM.game.numQ < 1){
					clearTimeout(this.ROOM.game.qTimer);
					this.ROOM.turnEnd();
				}
			}else client.send('turnHint', { value: text });
		}else{
			client.chat(text);
		}
	}

	getScore(text, delay) {
		var rank = this.ROOM.game.hum - this.ROOM.game.primary + 3;
		var tr = 1 - delay / this.ROOM.game.roundTime;
		var score = (rank * rank * 3) * ( 0.5 + 0.5 * tr );

		return Math.round(score * this.ROOM.game.themeBonus);
	}
}