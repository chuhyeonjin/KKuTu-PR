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

const _Escape = require("pg-escape");

function Escape(str, ...args){
    let i = 0;

    return str.replace(/%([%sILQkKV])/g, (_, type) => {
        if ('%' === type) return '%';

        const arg = args[i++];
        switch (type) {
            case 's': return _Escape.string(arg);
            case 'I': return _Escape.ident(arg);
            case 'L': return _Escape.literal(arg);
            case 'Q': return _Escape.dollarQuotedString(arg);
            case 'k': return _Escape.asSKey(arg);
            case 'K': return _Escape.asKey(arg);
            case 'V': return _Escape.asValue(arg);
        }
    });
};

module.exports = Escape;

// (JSON ENDPOINT) KEY
_Escape.asSKey = function(val){
    let c;

    if(val.indexOf(".") === -1) return _Escape.asKey(val);
    c = val.split('.').map(function(item, x){ return x ? _Escape.literal(item) : _Escape.ident(item); });

    return c.slice(0, c.length - 1).join('->') + '->>' + c[c.length - 1];
};

// KEY
_Escape.asKey = function(val){
    if(val.indexOf(".") === -1){
        const v = _Escape.ident(val);

        if(v.charAt(0) === "\"") return v;
        else return "\"" + v + "\"";
    }
    const ar = val.split('.'), aEnd = ar.pop();

    return ar.map((item, x) => { return x ? `'${_Escape.literal(item)}'` : _Escape.ident(item); }).join('->') + `->>'${aEnd}'`;
};

// VALUE
_Escape.asValue = (val) => {
    const type = typeof val;

    if(val instanceof Array) return _Escape.literal("{" + val.join(',') + "}");
    if(type === 'number') return val;
    if(type === 'string') return _Escape.literal(val);
    return _Escape.literal(JSON.stringify(val));
};