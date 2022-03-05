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

exports.all = function(tails){
	const R = new exports.Tail();
	const returns = [];
	let left = tails.length;

	function onEnded(data, i){
		returns[i] = data;
		if(--left === 0) R.go(returns);
	}
	
	if (left === 0) R.go(true);
	else for(const i in tails){
		if(tails[i]) tails[i].then(onEnded, Number(i));
		else left--;
	}

	return R;
};

exports.Tail = function(){
	let callback
	let value = undefined;
	let i;

	this.go = (data) => {
		callback ? callback(data, i) : value = data;
	};
	this.then = (cb, _i) => {
		i = _i;
		value === undefined ? callback = cb : cb(value, _i);
	};
}