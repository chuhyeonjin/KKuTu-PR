const lizard = require('./lizard');

test('all은 매개변수로 빈 배열이 주어졌을떄 true를 보내주어야함', () => {
    function callback(data) {
        expect(data).toBeTruthy();
    }

    lizard.all([]).then(callback);
})

test('all은 매개변수로 주어진 배열중 falsy한 값이 있을때 무시해야함', () => {
    const testData = ["tail!"];
    const tails = [new lizard.Tail(), undefined];

    function callback(data) {
        expect(data).toStrictEqual(testData);
    }

    lizard.all(tails).then(callback);

    for(const i in testData) {
        tails[i].go(testData[i]);
    }
})

test('all은 작동해야함', () => {
    const testData = ["tail!", "head!"];
    const tails = [new lizard.Tail(), new lizard.Tail()];

    function callback(data) {
        expect(data).toStrictEqual(testData);
    }

    lizard.all(tails).then(callback);

    for(const i in tails) {
        tails[i].go(testData[i]);
    }
})

test('tail은 작동해야함', () => {
    const testData = "tail!";

    function callback(data) {
        expect(data).toBe(testData);
    }

    const R = new lizard.Tail();

    R.then(callback);
    R.go(testData);
})