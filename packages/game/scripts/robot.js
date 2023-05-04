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

const DB	 = require('kkutu-common/db');
const len = Number(process.argv[2] || 10);

DB.ready = () => {
  DB.kkutu['ko'].find(['hit', { $gte: 1 }]).sort(['hit', -1]).limit(len).on(($res) => {
    const res = [];

    let rank = 0;
    let previousHit = 0;
		
    for (const i in $res) {
      const { _id: word, hit } = $res[i];

      if (previousHit !== hit) {
        rank = Number(i) + 1;
        previousHit = hit;
      }
      const c = rank;

      res.push(`${c}위. ${word} (${hit})`);
    }

    console.log(res.join('\n'));
    process.exit();
  });
};