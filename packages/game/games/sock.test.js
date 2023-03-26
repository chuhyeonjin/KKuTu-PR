afterEach(() => {
    jest.restoreAllMocks();
});

const sock = require('./sock');

test('getTitle 테스트', (done) => {
    const game = new sock();

    game.getTitle().then((title) => {
        expect(title).toBe('①②③④⑤⑥⑦⑧⑨⑩');
        done();
    })
});

test('게임이 끝날 라운드가 아닐때 roundReady 테스트', () => {
    jest.spyOn(global, 'setTimeout');
    jest.spyOn(Math, 'random').mockReturnValue(0.1);

    const onMock = jest.fn().mockImplementation((callback) => {
     callback([{_id: '사과'}, {_id: '바나나'}, {_id: '포도'}, {_id: '딸기'}, {_id: '수박'}, {_id: '참외'}, {_id: '키위'}, {_id: '오렌지'}, {_id: '토마토'}, {_id: '감자'}]);
    })
    const limitMock = jest.fn().mockReturnValue({on: onMock});
    const findMock = jest.fn().mockReturnValue({limit: limitMock});

    const db = {
        kkutu: {
            ko: {find: findMock}
        }
    }

    const room = {game:{round: 1}, round: 3, rule: {lang: 'ko'}, byMaster: jest.fn(), turnStart: jest.fn()};
    const game = new sock(db, undefined, room);

    game.roundReady();

    expect(room.game.board).toBe("감키　　　　나나오자포도딸기수박참외렌위사과　　　　　　지　　　　　　　　　토　　　　　　　　　마　　　　　　　　　토　　　　바");
});


test('turnStart 테스트', () => {
    jest.useFakeTimers({})
    const room = {game: {}, turnEnd: jest.fn(), byMaster:jest.fn()};
    const game = new sock(undefined, undefined, room);

    game.turnStart();
    expect(room.game.roundAt).toBe(Date.now());
});