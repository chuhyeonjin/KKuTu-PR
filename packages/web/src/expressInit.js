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

const Express = require("express");
const Parser = require("body-parser");
const Exession = require("express-session");
const Redis = require("redis");
const passport = require("passport");
const Const = require("kkutu-common/const");
const Redission = require("connect-redis")(Exession);
const DDDoS	      = require("dddos");

module.exports = (server, useRedis) => {
    server.set('views', __dirname + "/views");
    server.set('view engine', "pug");
    server.use(Express.static(__dirname + "/public"));
    server.use(Parser.urlencoded({ extended: true }));
    server.use(Exession({
        store: useRedis ? new Redission({
            client: Redis.createClient(),
            ttl: 3600 * 12
        }) : undefined,
        secret: 'kkutu',
        resave: false,
        saveUninitialized: true
    }));
    server.use(passport.initialize());
    server.use(passport.session());
    server.use((req, res, next) => {
        if(req.session.passport) {
            delete req.session.passport;
        }
        next();
    });
    server.use((req, res, next) => {
        if(Const.IS_SECURED && req.protocol === 'http') {
            const host = req.get('host');
            res.status(302).redirect(`https://${host}${req.path}`);
        } else {
            next();
        }
    });

    /* use this if you want

    DDDoS = new DDDoS({
	    maxWeight: 6,
	    checkInterval: 10000,
	    rules: [{
		    regexp: "^/(cf|dict|gwalli)",
		    maxWeight: 20,
		    errorData: "429 Too Many Requests"
	    }, {
		    regexp: ".*",
		    errorData: "429 Too Many Requests"
	    }]
    });
    DDDoS.rules[0].logFunction = DDDoS.rules[1].logFunction = function(ip, path){
	    JLog.warn(`DoS from IP ${ip} on ${path}`);
    };
    Server.use(DDDoS.express());*/
}