describe('checkpub 테스트', () => {
    const oldEnv = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...oldEnv };
    });

    afterAll(() => {
        process.env = oldEnv;
    })

    test('checkpub은 NODE_ENV가 development 일때 global.isPublic을 false로 설정해야함', () => {
        process.env.NODE_ENV = 'development';

        const checkpub = require('./checkpub');

        expect(global.isPublic).toBeFalsy();
    })

    test('checkpub은 NODE_ENV가 development 가 아닐때 global.isPublic을 true로 설정해야함', () => {
        process.env.NODE_ENV = 'prod';

        const checkpub = require('./checkpub');

        expect(global.isPublic).toBeTruthy();
    })

    test('checkpub은 exports.ready가 설정되었을때 global.isPublic을 매개변수로 하여 호출해야함', () => {
        process.env.NODE_ENV = undefined;

        function callback(isPub) {
            expect(isPub).toBeTruthy();
        }

        const checkpub = require('./checkpub').ready = callback;
    })
})