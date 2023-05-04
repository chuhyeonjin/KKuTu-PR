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

const Cluster = require('cluster');
const Const = require('kkutu-common/const');
const JLog = require('kkutu-common/jjlog');

const sidArg = process.argv[2];
const cpuArg = process.argv[3];

if (sidArg === 'test') {
  global.test = true;
} else if (isNaN(sidArg)) {
  console.log(`Invalid Server ID ${process.argv[2]}`);
  process.exit(1);
}

if (isNaN(cpuArg)) {
  console.log(`Invalid CPU Number ${process.argv[3]}`);
  process.exit(1);
}

const SID = Number(sidArg);
const CPU = global.test ? 1 : Number(cpuArg);

if (Cluster.isPrimary) {
  const workers =
    new Array(CPU).fill()
      .map((_, i) =>
        Cluster.fork({ SERVER_NO_FORK: true, KKUTU_PORT: Const.MAIN_PORTS[SID] + 416 + i, CHANNEL: i + 1 })
      ).reduce((before, worker, i) => ({ ...before, [i + 1]: worker }), {});

  Cluster.on('exit', (diedWorker) => {
    const workerNumber = Object.values(workers).indexOf(diedWorker) + 1;
    JLog.error(`Worker @${workerNumber} ${diedWorker.process.pid} died`);
    workers[workerNumber] =
      Cluster.fork({
        SERVER_NO_FORK: true,
        KKUTU_PORT: Const.MAIN_PORTS[SID] + 416 + (workerNumber - 1),
        CHANNEL: workerNumber
      });
  });
  process.env['KKUTU_PORT'] = Const.MAIN_PORTS[SID];
  require('./master.js').init(SID.toString(), workers);
} else {
  require('./slave.js');
}