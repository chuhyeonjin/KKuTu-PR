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

const Agent = require("./redisAgent");

describe('RedisTable 테스트', () => {
    jest.setTimeout(500);

    const redisKey = 'key-abcde';

    test('putGlobal 테스트', done => {
        const data = {targetId: 'some-id-53022', score: 12300};
        const zaddMock = jest.fn((_, callback) => { callback() });
        const agent = new Agent({'zadd': zaddMock});
        const table = agent.Table(redisKey);

        table.putGlobal(data.targetId, data.score).then((result) => {
            try {
                expect(result).toBe(data.targetId);
                expect(zaddMock.mock.calls.length).toBe(1);
                expect(zaddMock.mock.lastCall[0]).toStrictEqual([redisKey, data.score, data.targetId]);
                done();
            } catch (error) {
                done(error);
            }
        });
    });

    test('getGlobal 테스트', done => {
        // score 내림차순으로 데이터 작성
        const data = {targetId: 'some-id-53022', rank: 10};
        const zrevrankMock = jest.fn((_, callback) => { callback(undefined, data.rank) });
        const agent = new Agent({'zrevrank': zrevrankMock});
        const table = agent.Table(redisKey);

        table.getGlobal(data.targetId).then((result) => {
            try {
                expect(result).toBe(data.rank);
                expect(zrevrankMock.mock.calls.length).toBe(1);
                expect(zrevrankMock.mock.lastCall[0]).toStrictEqual([redisKey, data.targetId]);
                done();
            } catch (error) {
                done(error);
            }
        });
    });

    test('getPage 테스트', done => {
        const data = {
            page: 2,
            itemsPerPage: 5,
            zrevrangeResult : [
                'some-id-53022', 53022,
                'some-id-12345', 5302,
                'some-id-abcde', 5301,
                'some-id-123', 1234,
                'some-id-a', 1
            ],
        };
        const expectedResult = {
            'page': data.page,
            'data': [
                {id: 'some-id-53022', rank: 10, score: 53022},
                {id: 'some-id-12345', rank: 11, score: 5302},
                {id: 'some-id-abcde', rank: 12, score: 5301},
                {id: 'some-id-123', rank: 13, score: 1234},
                {id: 'some-id-a', rank: 14, score: 1}
            ]
        }
        const zrevrangeMock = jest.fn((_, callback) => { callback(undefined, data.zrevrangeResult) });
        const agent = new Agent({'zrevrange': zrevrangeMock});
        const table = agent.Table(redisKey);

        table.getPage(data.page, data.itemsPerPage).then((result) => {
            try {
                expect(result).toStrictEqual(expectedResult);
                expect(zrevrangeMock.mock.calls.length).toBe(1);
                expect(zrevrangeMock.mock.lastCall[0]).toStrictEqual([redisKey, 10, 14, "WITHSCORES"]);
                done();
            } catch (error) {
                done(error);
            }
        })
    });

    test('getSurround 테스트', done => {
        const data = {
            targetId: 'some-id-53022',
            range: 5,
            rank: 10,
            zrevrangeResult: [
                'some-id-gaegosu', 12357777,
                'some-id-12345', 53022,
                'some-id-abcde', 5302,
                'some-id-def', 5301,
                'some-id-53022', 1234
            ]
        };
        const expectedResult = {
            target: data.targetId,
            data: [
                {id: 'some-id-gaegosu', rank: 6, score: 12357777},
                {id: 'some-id-12345', rank: 7, score: 53022},
                {id: 'some-id-abcde', rank: 8, score: 5302},
                {id: 'some-id-def', rank: 9, score: 5301},
                {id: 'some-id-53022', rank: 10, score: 1234}
            ]
        }
        const zrevrankMock = jest.fn((_, callback) => { callback(undefined, data.rank) });
        const zrevrangeMock = jest.fn((_, callback) => { callback(undefined, data.zrevrangeResult) });
        const agent = new Agent({'zrevrank': zrevrankMock, 'zrevrange': zrevrangeMock});
        const table = agent.Table(redisKey);

        table.getSurround(data.targetId, data.range).then((result) => {
            try {
                expect(result).toStrictEqual(expectedResult);
                expect(zrevrangeMock.mock.calls.length).toBe(1);
                expect(zrevrankMock.mock.calls.length).toBe(1);
                expect(zrevrangeMock.mock.lastCall[0]).toStrictEqual([redisKey, 6, 10, "WITHSCORES"]);
                expect(zrevrankMock.mock.lastCall[0]).toStrictEqual([redisKey, data.targetId]);
                done();
            } catch (error) {
                done(error);
            }
        })
    });

});
