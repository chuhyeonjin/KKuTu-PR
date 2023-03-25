const typing = require('./typing');

afterEach(() => {
    jest.restoreAllMocks();
});

test('getTitle 테스트', (done) => {
    const dic = {
        'player-1': {game: {}},
        'player-2': {game: {}}
    }
    const room = {
        opts: {
            proverb: false
        },
        rule: {
            lang: 'ko'
        },
        game: {
            seq: ['player-1', 'player-2']
        },
        round: 2,
    }

    const onMock = jest.fn().mockImplementation((callback) => {
        callback([{_id: '가나' }, { _id: '나' }, {_id:'다'}]);
    })

    const limitMock = jest.fn().mockReturnValue({
        on: onMock
    })

    const findMock = jest.fn().mockReturnValue({
        limit: limitMock
    })

    const db = {
        kkutu: {
            'ko': {
                find: findMock
            }
        }
    }

    const game = new typing(db, dic, room);
    game.getTitle().then((title) => {
        expect(findMock).toBeCalledTimes(1);
        expect(findMock).toBeCalledWith([ '_id', /^.{2,5}$/ ], [ 'hit', { $gte: 1 } ]);

        expect(limitMock).toBeCalledTimes(1);
        expect(limitMock).toBeCalledWith(416);

        expect(onMock).toBeCalledTimes(1);

        expect(room.game.lists.length).toBe(room.round);
        expect(room.game.lists.every((list) => list.every((entry) => typeof entry === 'string'))).toBe(true);

        expect(title).toBe('①②③④⑤⑥⑦⑧⑨⑩');

        expect(dic['player-1'].game.spl).toBe(0);
        expect(dic['player-2'].game.spl).toBe(0);

        done();
    })
})

test('getTitle 속담모드 테스트', (done) => {
    const dic = {
        'player-1': {game: {}},
        'player-2': {game: {}}
    }
    const room = {
        opts: {
            proverb: true
        },
        rule: {
            lang: 'ko'
        },
        game: {
            seq: ['player-1', 'player-2']
        },
        round: 2,
    }

    const game = new typing(undefined, dic, room);
    game.getTitle().then((title) => {
        expect(room.game.lists.length).toBe(room.round);
        expect(room.game.lists.every((list) => list.every((entry) => typeof entry === 'string'))).toBe(true);

        expect(title).toBe('①②③④⑤⑥⑦⑧⑨⑩');

        expect(dic['player-1'].game.spl).toBe(0);
        expect(dic['player-2'].game.spl).toBe(0);

        done();
    })
})

test('게임이 끝나지 않았을때 roundReady 테스트', () => {
    jest.useFakeTimers();
    jest.spyOn(global, 'setTimeout');

    const room = {
        game: {
            round: 1,
            lists: [['가나', '가'], ['나','라']]
        },
        time: 60,
        round: 2,
        byMaster: jest.fn(),
        turnStart: jest.fn()
    };

    const game = new typing(undefined, undefined, room);
    game.roundReady();

    expect(room.game.round).toBe(2);
    expect(room.game.roundTime).toBe(60 * 1000);
    expect(room.game.clist).toStrictEqual(['가나', '가']);
    expect(room.game.lists).toStrictEqual([['나','라']]);

    expect(room.byMaster).toBeCalledTimes(1);
    expect(room.byMaster).toBeCalledWith('roundReady', {round: 2, list: ['가나', '가']}, true);
    expect(setTimeout).toBeCalledTimes(1);
    expect(setTimeout).toBeCalledWith(room.turnStart, 2400);
})

test('게임이 끝났을때 roundReady 테스트', () => {
    const dic = {
        'player-1': {game: {spl: 10}, id: 'player-1'},
        'player-2': {game: {spl: 2545}, id: 'player-2'},
    }
    const room = {
        game: {
            round: 2,
            seq:['player-1', 'player-2'],
            lists: []
        },
        time: 60,
        round: 2,
        roundEnd: jest.fn()
    };

    const game = new typing(undefined, dic, room);
    game.roundReady();

    expect(room.game.round).toBe(3);
    expect(room.game.roundTime).toBe(60 * 1000);
    expect(room.roundEnd).toBeCalledTimes(1);
    expect(room.roundEnd).toBeCalledWith({scores: {'player-1': 5, 'player-2': 1273}});
})

test('turnStart 테스트', () => {
    jest.useFakeTimers();
    jest.spyOn(global, 'setTimeout');

    const dic = {
        'player-1': {game: {}},
        'player-2': {game: {miss: 10, index: 11, semi: 10}}
    }
    const room = {
        game: {
            late: true,
            seq:['player-1', 'player-2'],
            roundTime: 10000,
        },
        turnEnd: jest.fn(),
        byMaster: jest.fn()
    }
    const game = new typing(undefined, dic, room);
    game.turnStart();

    expect(room.game.late).toBe(false);
    expect(dic).toStrictEqual({
        'player-1': {game: {miss: 0, index: 0, semi: 0}},
        'player-2': {game: {miss: 0, index: 0, semi: 0}}
    });

    expect(setTimeout).toBeCalledTimes(1);
    expect(setTimeout).toBeCalledWith(room.turnEnd, 10000);
    expect(room.game.qTimer).toBe(setTimeout.mock.results[0].value);

    expect(room.byMaster).toBeCalledTimes(1);
    expect(room.byMaster).toBeCalledWith('turnStart', {roundTime: 10000}, true);
})

test('끝날 라운드가 아닌 turnEnd 테스트', () => {
    jest.useFakeTimers();
    jest.spyOn(global, 'setTimeout');

    const dic = {
        'player-1': {game: {semi: 100, index: 10, miss: 1, spl : 0}, id: 'player-1'},
        'player-2': {game: {semi: 12, index: 4, miss: 3, spl: 12}, id: 'player-2'}
    }
    const room = {
        game: {
            late: false,
            seq: ['player-1', 'player-2'],
            round: 2,
        },
        time: 10,
        byMaster: jest.fn(),
        roundReady: jest.fn(),
        round: 3,
    }
    const game = new typing(undefined, dic, room);
    game.turnEnd();

    expect(room.game.late).toBe(true);
    expect(dic["player-1"].game.spl).toBe(654);
    expect(dic["player-2"].game.spl).toBe(90);
    expect(room.byMaster).toBeCalledTimes(1);
    expect(room.byMaster).toBeCalledWith('turnEnd', {ok: false, speed: {'player-1': 654, 'player-2': 78}});

    expect(setTimeout).toHaveBeenCalledTimes(1);
    expect(setTimeout).toHaveBeenLastCalledWith(room.roundReady, 10000);
    expect(room.game._rrt).toBe(setTimeout.mock.results[0].value);
})

test('끝날 라운드 일때 turnEnd 테스트', () => {
    jest.useFakeTimers();
    jest.spyOn(global, 'setTimeout');

    const dic = {
        'player-1': {game: {semi: 100, index: 10, miss: 1, spl : 0}, id: 'player-1'},
        'player-2': {game: {semi: 12, index: 4, miss: 3, spl: 12}, id: 'player-2'}
    }
    const room = {
        game: {
            late: false,
            seq: ['player-1', 'player-2'],
            round: 3,
        },
        time: 10,
        byMaster: jest.fn(),
        roundReady: jest.fn(),
        round: 3,
    }
    const game = new typing(undefined, dic, room);
    game.turnEnd();

    expect(room.game.late).toBe(true);
    expect(dic["player-1"].game.spl).toBe(654);
    expect(dic["player-2"].game.spl).toBe(90);
    expect(room.byMaster).toBeCalledTimes(1);
    expect(room.byMaster).toBeCalledWith('turnEnd', {ok: false, speed: {'player-1': 654, 'player-2': 78}});

    expect(setTimeout).toHaveBeenCalledTimes(1);
    expect(setTimeout).toHaveBeenLastCalledWith(room.roundReady, 3000);
    expect(room.game._rrt).toBe(setTimeout.mock.results[0].value);
})

test('올바른 정답으로 submit 테스트 & client.game.index를 1 증가해야함', () => {
    const client = {
        game: {
            index: 0,
            semi: 2,
            score: 1,
        },
        publish: jest.fn(),
        id: 'some-player',
        invokeWordPiece: jest.fn()
    };
    const text = 'apple';
    const room = {
        game: {
            clist: [text, 'banana']
        },
        getScore: jest.fn().mockReturnValue(10)
    };

    const game = new typing(undefined, undefined, room);
    game.submit(client, text);

    expect(room.getScore).toBeCalledTimes(1);
    expect(room.getScore).toBeCalledWith(text);

    expect(client.game.semi).toBe(12);
    expect(client.game.score).toBe(11);

    expect(client.publish).toBeCalledTimes(1);
    expect(client.publish).toBeCalledWith('turnEnd', {
        target: client.id,
        ok: true,
        value: text,
        score: 10
    }, true)

    expect(client.invokeWordPiece).toBeCalledTimes(1);
    expect(client.invokeWordPiece).toBeCalledWith(text, 0.5);

    expect(client.game.index).toBe(1);
});

test('올바르지 않는 정답으로 submit 테스트 & clist 끝에 도달하면 처음으로 돌아가야함', () => {
    const client = {
        game: {
            miss: 1,
            index: 1,
        },
        send: jest.fn()
    };

    const room = {
        game: {
            clist: ['apple', 'banana']
        }
    };

    const game = new typing(undefined, undefined, room);
    const text = 'wrong';
    game.submit(client, text);

    expect(client.game.miss).toBe(2);
    expect(client.send).toBeCalledTimes(1);
    expect(client.send).toBeCalledWith('turnEnd', { error: true });

    expect(client.game.index).toBe(0);
});

test('한국어의 getScore 테스트', () => {
    const room = {
        rule: {
            lang: 'ko'
        }
    };
    const game = new typing(undefined, undefined, room);
    expect(game.getScore('a1가각와왮읙')).toBe(19);
});

test('영어의 getScore 테스트', () => {
    const room = {
        rule: {
            lang: 'en'
        }
    };
    const game = new typing(undefined, undefined, room);
    const text = '1234567890';
    expect(game.getScore(text)).toBe(text.length);
});

test('지원하지 않는 언어의 getScore 테스트', () => {
    const room = {
        rule: {
            lang: 'jp'
        }
    };
    const game = new typing(undefined, undefined, room);
    expect(game.getScore('shdafjks')).toBe(0);
});