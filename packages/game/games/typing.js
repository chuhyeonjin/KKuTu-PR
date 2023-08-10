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

const File = require('fs');

// { 'langCode': ["proverb1", ...], ... }
const PROVERBS =
	Object.fromEntries(
		File.readFileSync(`${__dirname}/../../../data/proverbs.txt`, {encoding: 'utf-8'})
			.split('~~~')
			.map((langAndProverbs) => {
				const split = langAndProverbs.split(/\r\n|\r|\n/);
				return [split.shift(), split];
			})
	);

const LIST_LENGTH = 200;
// ㅘ, ㅙ, ㅚ, ㅝ, ㅞ, ㅟ, ㅢ
const DOUBLE_VOWELS = [ 9, 10, 11, 14, 15, 16, 19 ];
// ㄳ, ㄵ, ㄶ, ㄺ, ㄻ, ㄼ, ㄽ, ㄾ, ㄿ, ㅀ, ㅄ
const DOUBLE_TAILS = [ 3, 5, 6, 9, 10, 11, 12, 13, 14, 15, 18 ];

module.exports = class {
	constructor(_DB, _DIC, _ROOM) {
		this.DB = _DB;
		this.DIC = _DIC;
		this.ROOM = _ROOM;
	}

	traverse(func) {
		for(const user of this.ROOM.game.seq){
			const o = this.DIC[user];
			if(o?.game) func(o);
		}
	}

	async getTitle() {
		const pick = list => {
			this.ROOM.game.lists =
				new Array(this.ROOM.round).fill()
					.map(() => new Array(LIST_LENGTH).fill()
						.map(() => list[Math.floor(Math.random() * list.length)]))
		};

		if(this.ROOM.opts.proverb) pick(PROVERBS[this.ROOM.rule.lang]);
		else this.DB.kkutu[this.ROOM.rule.lang].find([ '_id', /^.{2,5}$/ ], [ 'hit', { $gte: 1 } ]).limit(416).on(($res) => {
			pick($res.map((item) => item._id ));
		});

		this.traverse((o) => {
			o.game.spl = 0;
		});

		return "①②③④⑤⑥⑦⑧⑨⑩";
	}

	roundReady() {
		if(!this.ROOM.game.lists) return;

		this.ROOM.game.round++;
		this.ROOM.game.roundTime = this.ROOM.time * 1000;

		if(this.ROOM.game.round <= this.ROOM.round){
			this.ROOM.game.clist = this.ROOM.game.lists.shift();
			this.ROOM.byMaster('roundReady', {
				round: this.ROOM.game.round,
				list: this.ROOM.game.clist
			}, true);
            setTimeout(() => { this.ROOM.turnStart(); }, 2400);
		} else {
			const scores = {};
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
		this.ROOM.game.qTimer = setTimeout(() => { this.ROOM.turnEnd(); }, this.ROOM.game.roundTime);
		this.ROOM.byMaster('turnStart', { roundTime: this.ROOM.game.roundTime }, true);
	}

	turnEnd() {
		const spl = {};

		this.ROOM.game.late = true;

		this.traverse((o) => {
			const sv = (o.game.semi + o.game.index - o.game.miss) / this.ROOM.time * 60;
			spl[o.id] = Math.round(sv);
			o.game.spl += sv;
		});

		this.ROOM.byMaster('turnEnd', {
			ok: false,
			speed: spl
		});

		const isGameEnded = this.ROOM.game.round === this.ROOM.round
		this.ROOM.game._rrt = setTimeout(() => { this.ROOM.roundReady(); }, isGameEnded ? 3000 : 10000);
	}

	submit(client, text) {
		if (!client.game) return;

		if(this.ROOM.game.clist[client.game.index] === text){
			const score = this.ROOM.getScore(text);

			client.game.semi += score;
			client.game.score += score;
			client.publish('turnEnd', {
				target: client.id,
				ok: true,
				value: text,
				score: score
			}, true);
			client.invokeWordPiece(text, 0.5);
		} else {
			client.game.miss++;
			client.send('turnEnd', { error: true });
		}

		client.game.index++;
		if(this.ROOM.game.clist.length <= client.game.index) client.game.index = 0;
	}

	getScore(text) {
		switch(this.ROOM.rule.lang){
			case 'ko': {
				let score = 0;
				for (let i = 0; i < text.length; i++) {
					const charCode = text.charCodeAt(i);
					// 44032 == '가'
					if (charCode >= 44032) {
						if (DOUBLE_VOWELS.includes(Math.floor(((charCode - 44032) % 588) / 28))) score++;

						// 종성, 0 -> 없음
						const tail = (charCode - 44032) % 28;
						score += tail ? 3 : 2;
						if (DOUBLE_TAILS.includes(tail)) score++;
					} else score++;
				}
				return score;
			}
			case 'en': return text.length;
			default: return 0;
		}
	}
}