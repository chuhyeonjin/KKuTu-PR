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

const Express	        = require("express");
const DB		        = require("kkutu-common/db");
const JLog	            = require("kkutu-common/jjlog");
const Secure            = require('kkutu-common/secure');
const Const	            = require("kkutu-common/const");
const https	            = require('https');
const expressInit       = require('./expressInit');
const gameClientManager = require('./gameClientManager');
require("kkutu-common/checkpub");

const useRedis = true;
const Language = {
	'ko_KR': require("./lang/ko_KR.json"),
	'en_US': require("./lang/en_US.json")
};
const ROUTES = [
	"major", "consume", "admin", "login"
];
const MOBILE_AVAILABLE = [
	"portal", "main", "kkutu"
];

const Server = Express();

JLog.info("<< KKuTu Web >>");
expressInit(Server, useRedis);

function updateLanguage(){
	for(const languageCode in Language){
		const src = `./lang/${languageCode}.json`;

		delete require.cache[require.resolve(src)];
		Language[languageCode] = require(src);
	}
}

function getLanguage(locale, page, shop){
	const L = Language[locale] || {};
	const R = {};

	for(const key in L.GLOBAL) R[key] = L.GLOBAL[key];
	if(shop) for(const key in L.SHOP) R[key] = L.SHOP[key];
	for(const key in L[page]) R[key] = L[page][key];
	if(R['title']) R['title'] = `[${process.env['KKT_SV_NAME']}] ${R['title']}`;

	return R;
}

function page(req, res, file, data = {}){
	if(req.session.createdAt){
		if(new Date() - req.session.createdAt > 60 * 60 * 1000){
			delete req.session.profile;
		}
	}else{
		req.session.createdAt = new Date();
	}

	data.published = global.isPublic;
	// URL ...?locale=en_US will show the page in English
	data.lang = req.query.locale || "ko_KR";
	if(!Language[data.lang]) data.lang = "ko_KR";
	data.locale = getLanguage(data.lang, data._page || file.split('_')[0], data._shop);
	data.session = req.session;
	if((/mobile/i).test(req.get('user-agent')) || req.query.mob){
		data.mobile = true;
		if(req.query.pc){
			data.as_pc = true;
			data.page = file;
		}else if(MOBILE_AVAILABLE && MOBILE_AVAILABLE.includes(file)){
			data.page = 'm_' + file;
		}else{
			data.mobile = false;
			data.page = file;
		}
	}else{
		data.page = file;
	}

	const addr = req.ip || "";
	const sid = req.session.id || "";
	JLog.log(`${addr.slice(7)}@${sid.slice(0, 10)} ${data.page}, ${JSON.stringify(req.params)}`);
	res.render(data.page, data, (err, html) => {
		if(err) res.send(err.toString());
		else res.send(html);
	});
}

Server.get("/language/:page/:lang", function(req, res){
	let page = req.params.page.replaceAll("_", "/");
	const lang = req.params.lang;

	if(page.startsWith("m/")) page = page.slice(2);
	if(page === "portal") page = "kkutu";
	res.send("window.L = "+JSON.stringify(getLanguage(lang, page, true))+";");
});
Server.get("/language/flush", function(req, res){
	updateLanguage();
	res.sendStatus(200);
});

DB.ready = () => {
	setInterval(function(){
		DB.session.remove([ 'createdAt', { $lte: Date.now() - 12 * 60 * 60 * 1000 } ]).on();
	}, 10 * 60 * 1000);

	setInterval(function(){
		gameClientManager.seek();
	}, 4 * 1000);

	JLog.success("DB is ready.");

	DB.kkutu_shop_desc.find().on(($docs) => {
		for(const languageCode in Language) {
			Language[languageCode].SHOP = {};

			for(const j in $docs){
				Language[languageCode].SHOP[$docs[j]._id] = [ $docs[j][`name_${languageCode}`], $docs[j][`desc_${languageCode}`] ];
			}
		}
	});
	Server.listen(80);
	if(Const.IS_SECURED) {
		const options = Secure();
		https.createServer(options, Server).listen(443);
	}
};

ROUTES.forEach((route) => {
	require(`./routes/${route}`).run(Server, page);
});

Server.get("/", (req, res) => {
	DB.session.findOne([ '_id', req.session.id ]).on(function($ses){
		if(global.isPublic){
			onFinish($ses);
		}else{
			if($ses) $ses.profile.sid = $ses._id;
			onFinish($ses);
		}
	});

	function onFinish($doc){
		let id = req.session.id;
		if($doc){
			req.session.profile = $doc.profile;
			id = $doc.profile.sid;
		}else{
			delete req.session.profile;
		}

		const server = req.query.server;

		page(req, res, Const.MAIN_PORTS[server] ? "kkutu" : "portal", {
			'_page': "kkutu",
			'_id': id,
			'PORT': Const.MAIN_PORTS[server],
			'HOST': req.hostname,
			'PROTOCOL': Const.IS_SECURED ? 'wss' : 'ws',
			'TEST': req.query.test,
			'MOREMI_PART': Const.MOREMI_PART,
			'AVAIL_EQUIP': Const.AVAIL_EQUIP,
			'CATEGORIES': Const.CATEGORIES,
			'GROUPS': Const.GROUPS,
			'MODE': Const.GAME_TYPE,
			'RULE': Const.RULE,
			'OPTIONS': Const.OPTIONS,
			'KO_INJEONG': Const.KO_INJEONG,
			'EN_INJEONG': Const.EN_INJEONG,
			'KO_THEME': Const.KO_THEME,
			'EN_THEME': Const.EN_THEME,
			'IJP_EXCEPT': Const.IJP_EXCEPT,
			'ogImage': "http://kkutu.kr/img/kkutu/logo.png",
			'ogURL': "http://kkutu.kr/",
			'ogTitle': "글자로 놀자! 끄투 온라인",
			'ogDescription': "끝말잇기가 이렇게 박진감 넘치는 게임이었다니!"
		});
	}
});

Server.get("/servers", function(req, res){
	const list = gameClientManager.getList();
	res.send({ list: list, max: Const.KKUTU_MAX });
});

Server.get("/legal/:page", function(req, res){
	page(req, res, "legal/"+req.params.page);
});