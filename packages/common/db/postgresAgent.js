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
	var i, res = [];
	
	for(i in _q) if(_q[i]) res.push([ i, _q[i] ]);
	
	return res;
}
function uQuery(q, id){
	var i, res = [], noId = true;
	
	for(i in q){
		var c = q[i][0];
		
		if(q[i][0] == "_id"){
			noId = false;
		}else if(c.split) if((c = c.split('.')).length > 1){
			var jo = {}, j = jo;
			
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
		var c;
		
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
	var doN = inc ? function(k, v){
		return Escape("%K=%K+%V", k, k, v);
	} : function(k, v){
		return Escape("%K=%V", k, v);
	}, doJ = inc ? function(k, p, ok, v){
		JLog.warn("[sqlSet] Cannot increase a value in JSON object.");
		return null; //Escape("%K=jsonb_set(%K,%V,CAST(CAST(%k AS bigint)+%V AS text),true)", k, k, p, ok, Number(v));
	} : function(k, p, ok, v){
		return Escape("%K=jsonb_set(%K,%V,%V,true)", k, k, p, v);
	}
	return q.map(function(item){
		var c = item[0].split('.');
		
		if(c.length == 1){
			return doN(item[0], item[1]);
		}
		/* JSON 값 내부를 수정하기
			1. UPSERT 할 수 없다.
			2. 한 쿼리에 여러 값을 수정할 수 없다.
		*/
		if(typeof item[1] == 'number') item[1] = item[1].toString();
		return doJ(c[0], c.slice(1), item[0], item[1]);
	}).join(', ');
}
function sqlIK(q){
	return q.map(function(item){
		return Escape("%K", item[0]);
	}).join(', ');
}
function sqlIV(q){
	return q.map(function(item){
		return Escape("%V", item[1]);
	}).join(', ');
}
function isDataAvailable(data, chk){
	var i, j;
	var path;
	var cursor;
	
	if(data == null) return false;
	for(i in chk){
		cursor = data;
		path = i.split(".");
		for(j in path){
			if(cursor[path[j]] === null) return false;
			if(cursor.hasOwnProperty(path[j]) == chk[i]) cursor = data[path[j]];
			else return false;
		}
	}
	
	return true;
}

const pointer = function(origin, col, mode, q, flag){
	var _my = this;
	/* on: 입력받은 쿼리를 실행시킨다.
        @f		콜백 함수
        @chk	정보가 유효할 조건
        @onFail	유효하지 않은 정보일 경우에 대한 콜백 함수
    */
	_my.second = {};
	_my.sorts = null;

	this.on = function(f, chk, onFail){
		var sql;
		var sq = _my.second['$set'];
		var uq;

		function preCB(err, res){
			if(err){
				JLog.error("Error when querying: "+sql);
				JLog.error("Context: "+err.toString());
				if(onFail){
					JLog.log("onFail calling...");
					onFail(err);
				}
				return;
			}
			if(res){
				if(mode == "findOne"){
					if(res.rows) res = res.rows[0];
				}else if(res.rows) res = res.rows;
			}
			callback(err, res);
			/*
            if(mode == "find"){
                if(_my.sorts){
                    doc = doc.sort(_my.sorts);
                }
                doc.toArray(callback);
            }else callback(err, doc);*/
		}
		function callback(err, doc){
			if(f){
				if(chk){
					if(isDataAvailable(doc, chk)) f(doc);
					else{
						if(onFail) onFail(doc);
						else if(DEBUG) throw new Error("The data from "+mode+"["+JSON.stringify(q)+"] was not available.");
						else JLog.warn("The data from ["+JSON.stringify(q)+"] was not available. Callback has been canceled.");
					}
				}else f(doc);
			}
		}
		switch(mode){
			case "findOne":
				_my.findLimit = 1;
			case "find":
				sql = Escape("SELECT %s FROM %I", sqlSelect(_my.second), col);
				if(q) sql += Escape(" WHERE %s", sqlWhere(q));
				if(_my.sorts) sql += Escape(" ORDER BY %s", _my.sorts.map(function(item){
					return item[0] + ((item[1] == 1) ? ' ASC' : ' DESC');
				}).join(','));
				if(_my.findLimit) sql += Escape(" LIMIT %V", _my.findLimit);
				break;
			case "insert":
				sql = Escape("INSERT INTO %I (%s) VALUES (%s)", col, sqlIK(q), sqlIV(q));
				break;
			case "update":
				if(_my.second['$inc']){
					sq = sqlSet(_my.second['$inc'], true);
				}else{
					sq = sqlSet(sq);
				}
				sql = Escape("UPDATE %I SET %s", col, sq);
				if(q) sql += Escape(" WHERE %s", sqlWhere(q));
				break;
			case "upsert":
				// 업데이트 대상을 항상 _id(q의 가장 앞 값)로 가리키는 것으로 가정한다.
				uq = uQuery(sq, q[0][1]);
				sql = Escape("INSERT INTO %I (%s) VALUES (%s)", col, sqlIK(uq), sqlIV(uq));
				sql += Escape(" ON CONFLICT (_id) DO UPDATE SET %s", sqlSet(sq));
				break;
			case "remove":
				sql = Escape("DELETE FROM %I", col);
				if(q) sql += Escape(" WHERE %s", sqlWhere(q));
				break;
			case "createColumn":
				sql = Escape("ALTER TABLE %I ADD COLUMN %K %I", col, q[0], q[1]);
				break;
			default:
				JLog.warn("Unhandled mode: " + mode);
		}
		if(!sql) return JLog.warn("SQL is undefined. This call will be ignored.");
		// JLog.log("Query: " + sql.slice(0, 100));
		origin.query(sql, preCB);
		/*if(_my.findLimit){

            c = my.source[mode](q, flag, { limit: _my.findLimit }, preCB);
        }else{
            c = my.source[mode](q, _my.second, flag, preCB);
        }*/
		return sql;
	};
	// limit: find 쿼리에 걸린 문서를 필터링하는 지침을 정의한다.
	this.limit = function(_data){
		if(global.getType(_data) == "Number"){
			_my.findLimit = _data;
		}else{
			_my.second = query(arguments);
			_my.second.push([ '_id', true ]);
		}
		return this;
	};
	this.sort = function(_data){
		_my.sorts = (global.getType(_data) == "Array") ? query(arguments) : oQuery(_data);
		return this;
	};
	// set: update 쿼리에 걸린 문서를 수정하는 지침을 정의한다.
	this.set = function(_data){
		_my.second['$set'] = (global.getType(_data) == "Array") ? query(arguments) : oQuery(_data);
		return this;
	};
	// soi: upsert 쿼리에 걸린 문서에서, insert될 경우의 값을 정한다. (setOnInsert)
	this.soi = function(_data){
		_my.second['$setOnInsert'] = (global.getType(_data) == "Array") ? query(arguments) : oQuery(_data);
		return this;
	};
	// inc: update 쿼리에 걸린 문서의 특정 값을 늘인다.
	this.inc = function(_data){
		_my.second['$inc'] = (global.getType(_data) == "Array") ? query(arguments) : oQuery(_data);
		return this;
	};
};

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
