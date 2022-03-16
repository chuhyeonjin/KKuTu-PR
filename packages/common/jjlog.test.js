const jjlog = require('./jjlog');

beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2017-02-14T05:30:22'));
    jest.spyOn(console, 'log').mockImplementationOnce(() => {});
});

test('callLog는 로그를 제대로 포매팅 해야함', () => {
   jjlog.callLog('로그')
   expect(console.log).lastCalledWith('[2017-02-14 05:30:22] 로그')
});