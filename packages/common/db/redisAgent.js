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

const Lizard = require("../lizard");

module.exports = class {
    constructor(origin) {
        this.origin = origin;
    }

    Table(key) {
        return new RedisTable(this.origin, key);
    }
}

class RedisTable {
    constructor(origin, key) {
        this.origin = origin;
        this.key = key;
    }

    putGlobal(id, score) {
        const R = new Lizard.Tail();

        this.origin.zadd([ this.key, score, id ], () => {
            R.go(id);
        });
        return R;
    }

    getGlobal(id) {
        const R = new Lizard.Tail();

        this.origin.zrevrank([ this.key, id ], (_, res) => {
            R.go(res);
        });
        return R;
    }

    getPage(page, itemsPerPage) {
        const R = new Lizard.Tail();

        this.origin.zrevrange([ this.key, page * itemsPerPage, (page + 1) * itemsPerPage - 1, "WITHSCORES" ], (_, res) => {
            R.go({
                'page': page,
                data: new Array(res.length / 2).fill().map((_, i) => ({
                    id: res[i * 2],
                    rank: page * itemsPerPage + i,
                    score: res[i * 2 + 1],
                }))
            });
        });
        return R;
    }

    getSurround(targetId, range = 8) {
        const R = new Lizard.Tail();

        this.origin.zrevrank([ this.key, targetId ], (_, targetRank) => {
            // 앞 범위가 더 큼, 예) range = 5 / targetRank = 10 , rangeFrom = 6 /  rangeUntil = 10;
            // TODO: res가 range / 2 이하일 경우 구분해서 적용하면 해결 가능
            const rangeFrom = Math.max(0, targetRank - Math.round(range / 2 + 1));
            const rangeUntil = rangeFrom + range - 1

            this.origin.zrevrange([ this.key, rangeFrom, rangeUntil, "WITHSCORES" ], (_, res) => {
                R.go({
                    target: targetId,
                    data: res ? new Array(res.length / 2).fill().map((_, i) => ({
                        id: res[i * 2],
                        rank: i + rangeFrom,
                        score: res[i * 2 + 1]
                    })) : []
                });
            });
        });
        return R;
    }
};