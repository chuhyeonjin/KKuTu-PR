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
var DB;
var DIC;

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
	constructor(_DB, _DIC) {
		DB = _DB;
		DIC = _DIC;
	}

	getTitle() {
		var R = new Lizard.Tail();
		var my = this;

		// FIXME: 0.5초의 성능지연
		setTimeout(function(){
			R.go("①②③④⑤⑥⑦⑧⑨⑩");
		}, 500);
		return R;
	}

	roundReady() {
		var my = this;
		var words = [];
		var conf = LANG_STATS[my.rule.lang];
		var len = conf.len;
		var i, w;

		clearTimeout(my.game.turnTimer);
		my.game.round++;
		my.game.roundTime = my.time * 1000;
		if(my.game.round <= my.round){
			DB.kkutu[my.rule.lang].find([ '_id', conf.reg ], [ 'hit', { $gte: 1 } ], conf.add).limit(1234).on(function($docs){
				$docs.sort(function(a, b){ return Math.random() < 0.5; });
				while(w = $docs.shift()){
					words.push(w._id);
					i = w._id.length;
					if((len -= i) <= conf.min) break;
				}
				words.sort(function(a, b){ return b.length - a.length; });
				my.game.words = [];
				my.game.board = getBoard(words, conf.len);
				my.byMaster('roundReady', {
					round: my.game.round,
					board: my.game.board
				}, true);
				my.game.turnTimer = setTimeout(my.turnStart, 2400);
			});
		}else{
			my.roundEnd();
		}
	}

	turnStart() {
		var my = this;

		my.game.late = false;
		my.game.roundAt = (new Date()).getTime();
		my.game.qTimer = setTimeout(my.turnEnd, my.game.roundTime);
		my.byMaster('turnStart', {
			roundTime: my.game.roundTime
		}, true);
	}

	turnEnd() {
		var my = this;

		my.game.late = true;

		my.byMaster('turnEnd', {});
		my.game._rrt = setTimeout(my.roundReady, 3000);
	}

	submit(client, text, data) {
		var my = this;
		var play = (my.game.seq ? my.game.seq.includes(client.id) : false) || client.robot;
		var score, i;

		if(!my.game.words) return;
		if(!text) return;

		if(!play) return client.chat(text);
		if(text.length < (my.opts.no2 ? 3 : 2)){
			return client.chat(text);
		}
		if(my.game.words.indexOf(text) != -1){
			return client.chat(text);
		}
		DB.kkutu[my.rule.lang].findOne([ '_id', text ]).limit([ '_id', true ]).on(function($doc){
			if(!my.game.board) return;

			var newBoard = my.game.board;
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
				score = my.getScore(text);
				my.game.words.push(text);
				my.game.board = newBoard;
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
		/*if((i = my.game.words.indexOf(text)) != -1){
            score = my.getScore(text);
            my.game.words.splice(i, 1);
            client.game.score += score;
            client.publish('turnEnd', {
                target: client.id,
                value: text,
                score: score
            }, true);
            if(!my.game.words.length){
                clearTimeout(my.game.qTimer);
                my.turnEnd();
            }
            client.invokeWordPiece(text, 1.4);
        }else{
            client.chat(text);
        }*/
	}

	getScore(text, delay) {
		var my = this;

		return Math.round(Math.pow(text.length - 1, 1.6) * 8);
	}
}