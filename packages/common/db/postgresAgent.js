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

const DEBUG = true;

const JLog = require('../jjlog');
const Escape = require('./escape')

global.getType = function(obj){
	if(obj === undefined) return "";
	return obj.constructor.name;
};
function query(_q){
	return Array.from(_q).filter(q => q);
}
function oQuery(_q){
	const res = [];
	
	for(const i in _q) if(_q[i]) res.push([ i, _q[i] ]);
	
	return res;
}
function uQuery(q, id){
	let res = [], noId = true;
	
	for(const i in q){
		let c = q[i][0];

		if(q[i][0] === "_id"){
			noId = false;
		}else if(c.split) if((c = c.split('.')).length > 1){
			let jo = {}, j = jo;

			q[i][0] = c.shift();
			while(c.length > 1){
				j = j[c.shift()] = {};
			}
			j[c.shift()] = q[i][1];
			q[i][1] = JSON.stringify(jo);
		}
		res.push([ q[i][0], q[i][1] ]);
	}
	if(noId) res.push([ '_id', id ]);
	return res;
}
function sqlSelect(q){
	if(!Object.keys(q).length) return "*";
	
	return q.map(function(item){
		if(!item[1]) throw new Error(item[0]);
		return Escape("%K", item[0]);
	}).join(', ');
}
function sqlWhere(q){
	if(!Object.keys(q).length) return "TRUE";
	
	function wSearch(item){
		let c;

		if((c = item[1]['$not']) !== undefined) return Escape("NOT (%s)", wSearch([ item[0], c ]));
		if((c = item[1]['$nand']) !== undefined) return Escape("%K & %V = 0", item[0], c);
		if((c = item[1]['$lte']) !== undefined) return Escape("%K<=%V", item[0], c);
		if((c = item[1]['$gte']) !== undefined) return Escape("%K>=%V", item[0], c);
		if((c = item[1]['$in']) !== undefined){
			if(!c.length) return "FALSE";
			return Escape("%I IN (%s)", item[0], c.map(function(i){ return Escape("%V", i); }).join(','));
		}
		if((c = item[1]['$nin']) !== undefined){
			if(!c.length) return "TRUE";
			return Escape("%I NOT IN (%s)", item[0], c.map(function(i){ return Escape("%V", i); }).join(','));
		}
		if(item[1] instanceof RegExp) return Escape("%K ~ %L", item[0], item[1].source);
		return Escape("%K=%V", item[0], item[1]);
	}
	return q.map(wSearch).join(' AND ');
}
function sqlSet(q, inc){
	if(!q){
		JLog.warn("[sqlSet] Invalid query.");
		return null;
	}
	const doNumber =
		inc ? (k, v) => Escape("%K=%K+%V", k, k, v) :
			  (k, v) => Escape("%K=%V", k, v);
	const doJson =
		inc ? () => {
			JLog.warn("[sqlSet] Cannot increase a value in JSON object.");
			return null;
		} :
			(k, p, ok, v) => Escape("%K=jsonb_set(%K,%V,%V,true)", k, k, p, v);

	return q.map((item) => {
		const c = item[0].split('.');

		if(c.length === 1){
			return doNumber(item[0], item[1]);
		}
		/* JSON 값 내부를 수정하기
			1. UPSERT 할 수 없다.
			2. 한 쿼리에 여러 값을 수정할 수 없다.
		*/
		if(typeof item[1] == 'number') item[1] = item[1].toString();
		return doJson(c[0], c.slice(1), item[0], item[1]);
	}).join(', ');
}
function sqlIK(q){
	return q.map((item) => Escape("%K", item[0])).join(', ');
}
function sqlIV(q){
	return q.map((item) => Escape("%V", item[1])).join(', ');
}
function isDataAvailable(data, condition){
	if(data == null) return false;
	for(const i in condition){
		let cursor = data;
		const pathList = i.split(".");
		for(const path of pathList){
			if(cursor[path] === null) return false;
			if(cursor.hasOwnProperty(path) === condition[i]) cursor = data[path];
			else return false;
		}
	}
	
	return true;
}

class pointer {
	constructor(origin, col, mode, q) {
		this.origin = origin;
		this.col = col;
		this.mode = mode;
		this.q = q;

		this.second = {};
		this.sorts = null;
	}

	/* on: 입력받은 쿼리를 실행시킨다.
			@f		콜백 함수
			@chk	정보가 유효할 조건
			@onFail	유효하지 않은 정보일 경우에 대한 콜백 함수
		*/
	on(onSuccess, chk, onFail) {
		let sql;

		switch(this.mode){
			case "findOne":
				this.findLimit = 1;
			case "find":
				sql = Escape("SELECT %s FROM %I", sqlSelect(this.second), this.col);
				if(this.q) sql += Escape(" WHERE %s", sqlWhere(this.q));
				if(this.sorts) sql += Escape(" ORDER BY %s", this.sorts.map(function(item){
					return item[0] + ((item[1] === 1) ? ' ASC' : ' DESC');
				}).join(','));
				if(this.findLimit) sql += Escape(" LIMIT %V", this.findLimit);
				break;
			case "insert":
				sql = Escape("INSERT INTO %I (%s) VALUES (%s)", this.col, sqlIK(this.q), sqlIV(this.q));
				break;
			case "update":
				const sq = this.second['$inc'] ? sqlSet(this.second['$inc'], true) : sqlSet(this.second['$set']);
				sql = Escape("UPDATE %I SET %s", this.col, sq);
				if(this.q) sql += Escape(" WHERE %s", sqlWhere(this.q));
				break;
			case "upsert":
				// 업데이트 대상을 항상 _id(q의 가장 앞 값)로 가리키는 것으로 가정한다.
				const uq = uQuery(this.second['$set'], this.q[0][1]);
				sql = Escape("INSERT INTO %I (%s) VALUES (%s)", this.col, sqlIK(uq), sqlIV(uq));
				sql += Escape(" ON CONFLICT (_id) DO UPDATE SET %s", sqlSet(this.second['$set']));
				break;
			case "remove":
				sql = Escape("DELETE FROM %I", this.col);
				if(this.q) sql += Escape(" WHERE %s", sqlWhere(this.q));
				break;
			case "createColumn":
				sql = Escape("ALTER TABLE %I ADD COLUMN %K %I", this.col, this.q[0], this.q[1]);
				break;
			default:
				JLog.warn("Unhandled mode: " + this.mode);
		}
		if(!sql) return JLog.warn("SQL is undefined. This call will be ignored.");

		const callback = (doc)=>{
			if(!onSuccess) return;
			if(!chk) {
				onSuccess(doc);
				return;
			}

			if(isDataAvailable(doc, chk)) {
				onSuccess(doc);
				return;
			}

			if(onFail) {
				onFail(doc);
				return;
			}

			if(DEBUG) throw new Error("The data from "+this.mode+"["+JSON.stringify(this.q)+"] was not available.");
			else JLog.warn("The data from ["+JSON.stringify(this.q)+"] was not available. Callback has been canceled.");
		}

		this.origin.query(sql, (err, res) => {
			if(err){
				JLog.error("Error when querying: "+sql);
				JLog.error("Context: "+err.toString());
				if(onFail){
					JLog.log("onFail calling...");
					onFail(err);
				}
				return;
			}

			if(res && res.rows){
				if(this.mode === "findOne") res = res.rows[0];
				else res = res.rows;
			}

			callback(res);
		});
		return sql;
	};

	// limit: find 쿼리에 걸린 문서를 필터링하는 지침을 정의한다.
	limit(_data){
		if (global.getType(_data) === "Number"){
			this.findLimit = _data;
		} else{
			this.second = query(arguments);
			this.second.push([ '_id', true ]);
		}
		return this;
	};

	sort(_data){
		this.sorts = (global.getType(_data) === "Array") ? query(arguments) : oQuery(_data);
		return this;
	};

	// set: update 쿼리에 걸린 문서를 수정하는 지침을 정의한다.
	set(_data){
		this.second['$set'] = (global.getType(_data) === "Array") ? query(arguments) : oQuery(_data);
		return this;
	};

	// inc: update 쿼리에 걸린 문서의 특정 값을 늘인다.
	inc(_data) {
		this.second['$inc'] = (global.getType(_data) === "Array") ? query(arguments) : oQuery(_data);
		return this;
	}
}

module.exports = function(origin){
	this.Table = function(col){
		this.source = col;
		this.findOne = function(){
			return new pointer(origin, col, "findOne", query(arguments));
		};
		this.find = function(){
			return new pointer(origin, col, "find", query(arguments));
		};
		this.insert = function(){
			return new pointer(origin, col, "insert", query(arguments));
		};
		this.update = function(){
			return new pointer(origin, col, "update", query(arguments));
		};
		this.upsert = function(){
			return new pointer(origin, col, "upsert", query(arguments));
		};
		this.remove = function(){
			return new pointer(origin, col, "remove", query(arguments));
		};
		this.createColumn = function(name, type){
			return new pointer(origin, col, "createColumn", [ name, type ]);
		};
		this.direct = function(query, callback){
			JLog.warn("Direct query: " + query);
			origin.query(query, callback);
		};
	};
};
