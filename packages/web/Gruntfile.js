const LICENSE = [
	"Rule the words! KKuTu Online",
	"Copyright (C) 2017 JJoriping(op@jjo.kr)",
	"",
	"This program is free software: you can redistribute it and/or modify",
	"it under the terms of the GNU General Public License as published by",
	"the Free Software Foundation, either version 3 of the License, or",
	"(at your option) any later version.",
	"",
	"This program is distributed in the hope that it will be useful,",
	"but WITHOUT ANY WARRANTY; without even the implied warranty of",
	"MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the",
	"GNU General Public License for more details.",
	"",
	"You should have received a copy of the GNU General Public License",
	"along with this program. If not, see <http://www.gnu.org/licenses/>."
].join('\n');

const File = require('fs');

const KKUTU = "src/public/js/in_game_kkutu.min.js";
const LIST = [
	"global",
	
	"in_login",
	"in_game_kkutu",
	"in_game_kkutu_help",
	"in_admin",
	"in_portal",
	"in_loginfail"
];
const KKUTU_LIST = [
	"src/lib/kkutu/head.js",
	"src/lib/kkutu/ready.js",
	"src/lib/kkutu/rule_classic.js",
	"src/lib/kkutu/rule_jaqwi.js",
	"src/lib/kkutu/rule_crossword.js",
	"src/lib/kkutu/rule_typing.js",
	"src/lib/kkutu/rule_hunmin.js",
	"src/lib/kkutu/rule_daneo.js",
	"src/lib/kkutu/rule_sock.js",
	"src/lib/kkutu/body.js",
	"src/lib/kkutu/tail.js"
];

module.exports = function(grunt){
	const files = {};
	
	for(const fileName of LIST){
		files[`src/public/js/${fileName}.min.js`] = `src/lib/${fileName}.js`;
	}
	files[KKUTU] = KKUTU_LIST;
	
	grunt.initConfig({
		uglify: {
			options: {
				banner: "/**\n" + LICENSE + "\n*/\n\n"
			},
			build: {
				files: files
			}
		},
		concat: {
			basic: {
				src: KKUTU_LIST,
				dest: "src/lib/in_game_kkutu.js"
			}
		}
	});
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-concat');
	
	grunt.registerTask('default', ['concat', 'uglify']);
	grunt.registerTask('pack', 'Log', function(){
		const url = __dirname + "/" + KKUTU;

		const fileData = File.readFileSync(url, {encoding: 'utf-8'});
		File.writeFileSync(url, "(function(){" + fileData + "})();");
		this.async();
	});
};