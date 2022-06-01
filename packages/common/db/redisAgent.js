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

const RedisTable = function(origin, key){
    var my = this;

    my.putGlobal = function(id, score){
        var R = new Lizard.Tail();

        origin.zadd([ key, score, id ], function(err, res){
            R.go(id);
        });
        return R;
    };
    my.getGlobal = function(id){
        var R = new Lizard.Tail();

        origin.zrevrank([ key, id ], function(err, res){
            R.go(res);
        });
        return R;
    };
    my.getPage = function(pg, lpp){
        var R = new Lizard.Tail();

        origin.zrevrange([ key, pg * lpp, (pg + 1) * lpp - 1, "WITHSCORES" ], function(err, res){
            var A = [];
            var rank = pg * lpp;
            var i, len = res.length;

            for(i=0; i<len; i += 2){
                A.push({ id: res[i], rank: rank++, score: res[i+1] });
            }
            R.go({ page: pg, data: A });
        });
        return R;
    };
    my.getSurround = function(id, rv){
        var R = new Lizard.Tail();
        var i;

        rv = rv || 8;
        origin.zrevrank([ key, id ], function(err, res){
            // 앞 범위가 더 큼, 예) rv = 5 / res = 10 , range = [6, 10];
            // TODO: res가 rv / 2 이하일 경우 구분해서 적용하면 해결 가능
            var range = [ Math.max(0, res - Math.round(rv / 2 + 1)), 0 ];

            range[1] = range[0] + rv - 1;
            origin.zrevrange([ key, range[0], range[1], "WITHSCORES" ], function(err, res){
                if(!res) return R.go({ target: id, data: [] });

                var A = [], len = res.length;

                for(i=0; i<len; i += 2){
                    A.push({ id: res[i], rank: range[0]++, score: res[i+1] });
                }
                R.go({ target: id, data: A });
            });
        });
        return R;
    };
};