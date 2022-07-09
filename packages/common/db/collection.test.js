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

const collection = require('./collection');

const tableName = 'some-kkutu-table';

let table;
const originMock = jest.fn();

beforeEach(() => {
    originMock.mockRestore();
    const agent = new collection.Agent('Postgres', {query: originMock});
    table = new agent.PostgresTable(tableName);
});

describe('find & findOne 테스트', () => {
    test('모든 항목 find', () => {
        table.find().on(() => {});
        expect(originMock).toBeCalledTimes(1);
        expect(originMock.mock.lastCall[0]).toBe(`SELECT * FROM "some-kkutu-table" WHERE TRUE`);
    });

    test('조건 걸고 find', () => {
        table.find(['isHandsome', true], ['age', 530]).on(() => {});
        expect(originMock).toBeCalledTimes(1);
        expect(originMock.mock.lastCall[0]).toBe(`SELECT * FROM "some-kkutu-table" WHERE "isHandsome"='true' AND "age"=530`);
    });

    test.each([['ORDER BY id DESC', 0], ['ORDER BY id ASC', 1]])('%s 정렬 걸고 find', (expectedOrderSection, orderDirection) => {
        table.find().sort(['id', orderDirection]).on(() => {});
        expect(originMock).toBeCalledTimes(1);
        expect(originMock.mock.lastCall[0]).toBe(`SELECT * FROM "some-kkutu-table" WHERE TRUE ${expectedOrderSection}`);
    });

    test('개수 제한 걸고 find', () => {
        table.find().limit(5022).on(() => {});
        expect(originMock).toBeCalledTimes(1);
        expect(originMock.mock.lastCall[0]).toBe(`SELECT * FROM "some-kkutu-table" WHERE TRUE LIMIT 5022`);
    });

    test('특정 컬럼의 모든 항목 find', () => {
        table.find().limit(['some-column', true]).on(() => {});
        expect(originMock).toBeCalledTimes(1);
        expect(originMock.mock.lastCall[0]).toBe(`SELECT "some-column", "_id" FROM "some-kkutu-table" WHERE TRUE`);
    });

    test('모든 옵션과 함께 find', () => {
        table.find(['age', 17], ['name', 'kim min-su']).sort(['col', 0]).limit(143).limit(['id', true]).on(() => {});
        expect(originMock).toBeCalledTimes(1);
        expect(originMock.mock.lastCall[0]).toBe(`SELECT "id", "_id" FROM "some-kkutu-table" WHERE "age"=17 AND "name"='kim min-su' ORDER BY col DESC LIMIT 143`);
    });

    test('모든 옵션과 함께 findOne', () => {
        table.findOne(['age', 17], ['name', 'kim min-su']).sort(['col', 0]).limit(143).limit(['id', true]).on(() => {});
        expect(originMock).toBeCalledTimes(1);
        expect(originMock.mock.lastCall[0]).toBe(`SELECT "id", "_id" FROM "some-kkutu-table" WHERE "age"=17 AND "name"='kim min-su' ORDER BY col DESC LIMIT 1`);
    });
});

describe('insert 테스트', () => {
    test('테이블에 insert', () => {
        table.insert(['name', 'good'], ['age', 10]).on(() => {});
        expect(originMock).toBeCalledTimes(1);
        expect(originMock.mock.lastCall[0]).toBe(`INSERT INTO "some-kkutu-table" ("name", "age") VALUES ('good', 10)`);
    })
});

describe('update 테스트', () => {
    test('모든 항목 update', () => {
        table.update().set(['name', 'babo'], ['age', 170]).on(() => {});
        expect(originMock).toBeCalledTimes(1);
        expect(originMock.mock.lastCall[0]).toBe(`UPDATE "some-kkutu-table" SET "name"='babo', "age"=170 WHERE TRUE`);
    });

    test('조건 걸고 update', () => {
        table.update(['age', 17], ['name', 'you']).set(['name', 'babo'], ['age', 170]).on(() => {});
        expect(originMock).toBeCalledTimes(1);
        expect(originMock.mock.lastCall[0]).toBe(`UPDATE "some-kkutu-table" SET "name"='babo', "age"=170 WHERE "age"=17 AND "name"='you'`);
    });

    test('inc 걸고 update', () => {
        table.update().inc(['age', 16], ['level', 1]).on(() => {});
        expect(originMock).toBeCalledTimes(1);
        expect(originMock.mock.lastCall[0]).toBe(`UPDATE "some-kkutu-table" SET "age"="age"+16, "level"="level"+1 WHERE TRUE`);
    });
});

describe('upsert 테스트', () => {
    test('테이블에서 upsert', () => {
        table.upsert(['_id', 'some-id-asdf']).set(['age', 12], ['level', 10]).on(() => {});
        expect(originMock).toBeCalledTimes(1);
        expect(originMock.mock.lastCall[0]).toBe(`INSERT INTO "some-kkutu-table" ("age", "level", "_id") VALUES (12, 10, 'some-id-asdf') ON CONFLICT (_id) DO UPDATE SET "age"=12, "level"=10`);
    });
});

describe('remove 테스트', () => {
    test('모든 항목 remove', () => {
        table.remove().on(() => {});
        expect(originMock).toBeCalledTimes(1);
        expect(originMock.mock.lastCall[0]).toBe(`DELETE FROM "some-kkutu-table" WHERE TRUE`);
    });

    test('조건 걸고 remove', () => {
        table.remove(['age', 4], ['country', 'korea']).on(() => {});
        expect(originMock).toBeCalledTimes(1);
        expect(originMock.mock.lastCall[0]).toBe(`DELETE FROM "some-kkutu-table" WHERE "age"=4 AND "country"='korea'`);
    });
});

describe('createColumn 테스트', () => {
    test('테이블에서 createColumn', () => {
        table.createColumn('title', 'VARCHAR(100)').on(() => {});
        expect(originMock).toBeCalledTimes(1);
        expect(originMock.mock.lastCall[0]).toBe(`ALTER TABLE "some-kkutu-table" ADD COLUMN "title" "VARCHAR(100)"`);
    });
});



describe('direct 테스트', () => {
    test('테이블에서 direct로 쿼리', () => {
        const JLog = require('../jjlog');
        const JLogWarnMock = jest.fn(() => {});
        JLog.warn = JLogWarnMock

        const fakeCallback = () => {};
        table.direct(`SELECT * FROM "AAA"`, fakeCallback);
        expect(originMock).toBeCalledTimes(1);
        expect(originMock.mock.lastCall[0]).toBe(`SELECT * FROM "AAA"`);
        expect(originMock.mock.lastCall[1]).toStrictEqual(fakeCallback);
        expect(JLogWarnMock).toBeCalledTimes(1);
        expect(JLogWarnMock).toBeCalledWith(`Direct query: SELECT * FROM \"AAA\"`)
    })
});

