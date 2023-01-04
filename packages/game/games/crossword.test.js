const crossword = require('./crossword');

afterEach(() => {
    jest.restoreAllMocks();
});

test('getTitle 테스트', (done) => {
    jest.spyOn(Math, 'random').mockReturnValue(0);

    const room = {
        game: {},
        rule: {
            lang: 'ko'
        },
        round: 2
    };

    const dbBoardData = [
        {
            map: '쥐',
            data: '0,1,0,3,반주단|5,1,0,3,복와상|2,2,0,4,어깨동무|0,3,0,2,주주|6,3,0,2,복창|1,4,0,2,식객|5,4,0,2,음식|1,6,0,2,개석|5,6,0,2,수구|2,7,0,4,자객간인|0,1,1,3,반우주|1,0,1,2,소주|1,3,1,4,주식공개|2,1,1,2,단어|2,6,1,2,석자|5,1,1,2,복무|5,6,1,2,수인|6,0,1,2,운와|6,3,1,4,복식탁구|7,1,1,3,상수창'
        },
        {
            map: '쥐',
            data: '0,1,0,3,카나카|5,1,0,3,테라스|2,2,0,4,인격통일|0,3,0,2,이진|6,3,0,2,강감|1,4,0,2,퇴실|5,4,0,2,절구|1,6,0,2,곡물|5,6,0,2,흑월|2,7,0,4,자기소개|0,1,1,3,카보이|1,0,1,2,나나|1,3,1,4,진퇴유곡|2,1,1,2,카인|2,6,1,2,물자|5,1,1,2,테일|5,6,1,2,흑개|6,0,1,2,소라|6,3,1,4,강구연월|7,1,1,3,스릴감'
        },
        {
            map: '닻',
            data: '0,0,0,3,상상력|5,0,0,3,횡취곡|1,2,0,3,각저도|6,2,0,2,사수|0,3,0,2,막하|5,3,0,2,로진|3,4,0,3,사다트|0,5,0,2,이이|1,6,0,2,명수|4,6,0,3,미디어|6,7,0,2,장사|1,0,1,4,상고각하|7,0,1,3,곡호수|3,2,1,3,도지사|6,2,1,2,사진|0,3,1,3,막잡이|5,3,1,2,로트|4,4,1,3,다리미|1,5,1,2,이명|6,6,1,2,어장'
        }
    ]
    const db = {
        kkutu_cw: {
            'ko': {
                find: jest.fn().mockImplementation(() => {
                    return {
                        on: (callback) => {
                            callback(dbBoardData)
                        }
                    }
                })
            }
        },
        kkutu: {
            'ko': {
                findOne: jest.fn().mockImplementation(([_, word]) => {
                    return {
                        on: (callback) => {
                            callback({type: 1, theme: 1, mean: `${word} / ${word[0]},${word.slice(1)}`})
                        }
                    };
                })
            }
        }
    };
    const game = new crossword(db, undefined, room);
    game.getTitle().then((result) => {
        expect(room.game.started).toBe(false);
        expect(room.game.numQ).toBe(40);
        expect(room.game.prisoners).toStrictEqual({});
        expect(room.game.answers).toStrictEqual({
            "0,0,1,0": "반주단",
            "0,0,1,1": "반우주",
            "0,0,3,0": "주주",
            "0,1,0,1": "소주",
            "0,1,3,1": "주식공개",
            "0,1,4,0": "식객",
            "0,1,6,0": "개석",
            "0,2,1,1": "단어",
            "0,2,2,0": "어깨동무",
            "0,2,6,1": "석자",
            "0,2,7,0": "자객간인",
            "0,5,1,0": "복와상",
            "0,5,1,1": "복무",
            "0,5,4,0": "음식",
            "0,5,6,0": "수구",
            "0,5,6,1": "수인",
            "0,6,0,1": "운와",
            "0,6,3,0": "복창",
            "0,6,3,1": "복식탁구",
            "0,7,1,1": "상수창",
            "1,0,0,0": "상상력",
            "1,0,3,0": "막하",
            "1,0,3,1": "막잡이",
            "1,0,5,0": "이이",
            "1,1,0,1": "상고각하",
            "1,1,2,0": "각저도",
            "1,1,5,1": "이명",
            "1,1,6,0": "명수",
            "1,3,2,1": "도지사",
            "1,3,4,0": "사다트",
            "1,4,4,1": "다리미",
            "1,4,6,0": "미디어",
            "1,5,0,0": "횡취곡",
            "1,5,3,0": "로진",
            "1,5,3,1": "로트",
            "1,6,2,0": "사수",
            "1,6,2,1": "사진",
            "1,6,6,1": "어장",
            "1,6,7,0": "장사",
            "1,7,0,1": "곡호수"
        });
        expect(room.game.boards).toStrictEqual([[["0","1","0","3"],["5","1","0","3"],["2","2","0","4"],["0","3","0","2"],["6","3","0","2"],["1","4","0","2"],["5","4","0","2"],["1","6","0","2"],["5","6","0","2"],["2","7","0","4"],["0","1","1","3"],["1","0","1","2"],["1","3","1","4"],["2","1","1","2"],["2","6","1","2"],["5","1","1","2"],["5","6","1","2"],["6","0","1","2"],["6","3","1","4"],["7","1","1","3"]],[["0","0","0","3"],["5","0","0","3"],["1","2","0","3"],["6","2","0","2"],["0","3","0","2"],["5","3","0","2"],["3","4","0","3"],["0","5","0","2"],["1","6","0","2"],["4","6","0","3"],["6","7","0","2"],["1","0","1","4"],["7","0","1","3"],["3","2","1","3"],["6","2","1","2"],["0","3","1","3"],["5","3","1","2"],["4","4","1","3"],["1","5","1","2"],["6","6","1","2"]]]);
        expect(room.game.means).toStrictEqual([{"0,1,0":{"count":0,"dir":0,"len":3,"mean":"★/ 반,주단","theme":1,"type":1,"x":0,"y":1},"0,1,1":{"count":0,"dir":1,"len":3,"mean":"★/ 반,우주","theme":1,"type":1,"x":0,"y":1},"0,3,0":{"count":0,"dir":0,"len":2,"mean":"★/ 주,주","theme":1,"type":1,"x":0,"y":3},"1,0,1":{"count":0,"dir":1,"len":2,"mean":"★/ 소,주","theme":1,"type":1,"x":1,"y":0},"1,3,1":{"count":0,"dir":1,"len":4,"mean":"★/ 주,식공개","theme":1,"type":1,"x":1,"y":3},"1,4,0":{"count":0,"dir":0,"len":2,"mean":"★/ 식,객","theme":1,"type":1,"x":1,"y":4},"1,6,0":{"count":0,"dir":0,"len":2,"mean":"★/ 개,석","theme":1,"type":1,"x":1,"y":6},"2,1,1":{"count":0,"dir":1,"len":2,"mean":"★/ 단,어","theme":1,"type":1,"x":2,"y":1},"2,2,0":{"count":0,"dir":0,"len":4,"mean":"★/ 어,깨동무","theme":1,"type":1,"x":2,"y":2},"2,6,1":{"count":0,"dir":1,"len":2,"mean":"★/ 석,자","theme":1,"type":1,"x":2,"y":6},"2,7,0":{"count":0,"dir":0,"len":4,"mean":"★/ 자,객간인","theme":1,"type":1,"x":2,"y":7},"5,1,0":{"count":0,"dir":0,"len":3,"mean":"★/ 복,와상","theme":1,"type":1,"x":5,"y":1},"5,1,1":{"count":0,"dir":1,"len":2,"mean":"★/ 복,무","theme":1,"type":1,"x":5,"y":1},"5,4,0":{"count":0,"dir":0,"len":2,"mean":"★/ 음,식","theme":1,"type":1,"x":5,"y":4},"5,6,0":{"count":0,"dir":0,"len":2,"mean":"★/ 수,구","theme":1,"type":1,"x":5,"y":6},"5,6,1":{"count":0,"dir":1,"len":2,"mean":"★/ 수,인","theme":1,"type":1,"x":5,"y":6},"6,0,1":{"count":0,"dir":1,"len":2,"mean":"★/ 운,와","theme":1,"type":1,"x":6,"y":0},"6,3,0":{"count":0,"dir":0,"len":2,"mean":"★/ 복,창","theme":1,"type":1,"x":6,"y":3},"6,3,1":{"count":0,"dir":1,"len":4,"mean":"★/ 복,식탁구","theme":1,"type":1,"x":6,"y":3},"7,1,1":{"count":0,"dir":1,"len":3,"mean":"★/ 상,수창","theme":1,"type":1,"x":7,"y":1}},{"0,0,0":{"count":0,"dir":0,"len":3,"mean":"★/ 상,상력","theme":1,"type":1,"x":0,"y":0},"0,3,0":{"count":0,"dir":0,"len":2,"mean":"★/ 막,하","theme":1,"type":1,"x":0,"y":3},"0,3,1":{"count":0,"dir":1,"len":3,"mean":"★/ 막,잡이","theme":1,"type":1,"x":0,"y":3},"0,5,0":{"count":0,"dir":0,"len":2,"mean":"★/ 이,이","theme":1,"type":1,"x":0,"y":5},"1,0,1":{"count":0,"dir":1,"len":4,"mean":"★/ 상,고각하","theme":1,"type":1,"x":1,"y":0},"1,2,0":{"count":0,"dir":0,"len":3,"mean":"★/ 각,저도","theme":1,"type":1,"x":1,"y":2},"1,5,1":{"count":0,"dir":1,"len":2,"mean":"★/ 이,명","theme":1,"type":1,"x":1,"y":5},"1,6,0":{"count":0,"dir":0,"len":2,"mean":"★/ 명,수","theme":1,"type":1,"x":1,"y":6},"3,2,1":{"count":0,"dir":1,"len":3,"mean":"★/ 도,지사","theme":1,"type":1,"x":3,"y":2},"3,4,0":{"count":0,"dir":0,"len":3,"mean":"★/ 사,다트","theme":1,"type":1,"x":3,"y":4},"4,4,1":{"count":0,"dir":1,"len":3,"mean":"★/ 다,리미","theme":1,"type":1,"x":4,"y":4},"4,6,0":{"count":0,"dir":0,"len":3,"mean":"★/ 미,디어","theme":1,"type":1,"x":4,"y":6},"5,0,0":{"count":0,"dir":0,"len":3,"mean":"★/ 횡,취곡","theme":1,"type":1,"x":5,"y":0},"5,3,0":{"count":0,"dir":0,"len":2,"mean":"★/ 로,진","theme":1,"type":1,"x":5,"y":3},"5,3,1":{"count":0,"dir":1,"len":2,"mean":"★/ 로,트","theme":1,"type":1,"x":5,"y":3},"6,2,0":{"count":0,"dir":0,"len":2,"mean":"★/ 사,수","theme":1,"type":1,"x":6,"y":2},"6,2,1":{"count":0,"dir":1,"len":2,"mean":"★/ 사,진","theme":1,"type":1,"x":6,"y":2},"6,6,1":{"count":0,"dir":1,"len":2,"mean":"★/ 어,장","theme":1,"type":1,"x":6,"y":6},"6,7,0":{"count":0,"dir":0,"len":2,"mean":"★/ 장,사","theme":1,"type":1,"x":6,"y":7},"7,0,1":{"count":0,"dir":1,"len":3,"mean":"★/ 곡,호수","theme":1,"type":1,"x":7,"y":0}}]);
        expect(room.game.mdb).toStrictEqual([{"0,1":[{"count":0,"dir":0,"len":3,"mean":"★/ 반,주단","theme":1,"type":1,"x":0,"y":1},{"count":0,"dir":1,"len":3,"mean":"★/ 반,우주","theme":1,"type":1,"x":0,"y":1}],"0,2":[{"count":0,"dir":1,"len":3,"mean":"★/ 반,우주","theme":1,"type":1,"x":0,"y":1}],"0,3":[{"count":0,"dir":0,"len":2,"mean":"★/ 주,주","theme":1,"type":1,"x":0,"y":3},{"count":0,"dir":1,"len":3,"mean":"★/ 반,우주","theme":1,"type":1,"x":0,"y":1}],"1,0":[{"count":0,"dir":1,"len":2,"mean":"★/ 소,주","theme":1,"type":1,"x":1,"y":0}],"1,1":[{"count":0,"dir":0,"len":3,"mean":"★/ 반,주단","theme":1,"type":1,"x":0,"y":1},{"count":0,"dir":1,"len":2,"mean":"★/ 소,주","theme":1,"type":1,"x":1,"y":0}],"1,3":[{"count":0,"dir":0,"len":2,"mean":"★/ 주,주","theme":1,"type":1,"x":0,"y":3},{"count":0,"dir":1,"len":4,"mean":"★/ 주,식공개","theme":1,"type":1,"x":1,"y":3}],"1,4":[{"count":0,"dir":0,"len":2,"mean":"★/ 식,객","theme":1,"type":1,"x":1,"y":4},{"count":0,"dir":1,"len":4,"mean":"★/ 주,식공개","theme":1,"type":1,"x":1,"y":3}],"1,5":[{"count":0,"dir":1,"len":4,"mean":"★/ 주,식공개","theme":1,"type":1,"x":1,"y":3}],"1,6":[{"count":0,"dir":0,"len":2,"mean":"★/ 개,석","theme":1,"type":1,"x":1,"y":6},{"count":0,"dir":1,"len":4,"mean":"★/ 주,식공개","theme":1,"type":1,"x":1,"y":3}],"2,1":[{"count":0,"dir":0,"len":3,"mean":"★/ 반,주단","theme":1,"type":1,"x":0,"y":1},{"count":0,"dir":1,"len":2,"mean":"★/ 단,어","theme":1,"type":1,"x":2,"y":1}],"2,2":[{"count":0,"dir":0,"len":4,"mean":"★/ 어,깨동무","theme":1,"type":1,"x":2,"y":2},{"count":0,"dir":1,"len":2,"mean":"★/ 단,어","theme":1,"type":1,"x":2,"y":1}],"2,4":[{"count":0,"dir":0,"len":2,"mean":"★/ 식,객","theme":1,"type":1,"x":1,"y":4}],"2,6":[{"count":0,"dir":0,"len":2,"mean":"★/ 개,석","theme":1,"type":1,"x":1,"y":6},{"count":0,"dir":1,"len":2,"mean":"★/ 석,자","theme":1,"type":1,"x":2,"y":6}],"2,7":[{"count":0,"dir":0,"len":4,"mean":"★/ 자,객간인","theme":1,"type":1,"x":2,"y":7},{"count":0,"dir":1,"len":2,"mean":"★/ 석,자","theme":1,"type":1,"x":2,"y":6}],"3,2":[{"count":0,"dir":0,"len":4,"mean":"★/ 어,깨동무","theme":1,"type":1,"x":2,"y":2}],"3,7":[{"count":0,"dir":0,"len":4,"mean":"★/ 자,객간인","theme":1,"type":1,"x":2,"y":7}],"4,2":[{"count":0,"dir":0,"len":4,"mean":"★/ 어,깨동무","theme":1,"type":1,"x":2,"y":2}],"4,7":[{"count":0,"dir":0,"len":4,"mean":"★/ 자,객간인","theme":1,"type":1,"x":2,"y":7}],"5,1":[{"count":0,"dir":0,"len":3,"mean":"★/ 복,와상","theme":1,"type":1,"x":5,"y":1},{"count":0,"dir":1,"len":2,"mean":"★/ 복,무","theme":1,"type":1,"x":5,"y":1}],"5,2":[{"count":0,"dir":0,"len":4,"mean":"★/ 어,깨동무","theme":1,"type":1,"x":2,"y":2},{"count":0,"dir":1,"len":2,"mean":"★/ 복,무","theme":1,"type":1,"x":5,"y":1}],"5,4":[{"count":0,"dir":0,"len":2,"mean":"★/ 음,식","theme":1,"type":1,"x":5,"y":4}],"5,6":[{"count":0,"dir":0,"len":2,"mean":"★/ 수,구","theme":1,"type":1,"x":5,"y":6},{"count":0,"dir":1,"len":2,"mean":"★/ 수,인","theme":1,"type":1,"x":5,"y":6}],"5,7":[{"count":0,"dir":0,"len":4,"mean":"★/ 자,객간인","theme":1,"type":1,"x":2,"y":7},{"count":0,"dir":1,"len":2,"mean":"★/ 수,인","theme":1,"type":1,"x":5,"y":6}],"6,0":[{"count":0,"dir":1,"len":2,"mean":"★/ 운,와","theme":1,"type":1,"x":6,"y":0}],"6,1":[{"count":0,"dir":0,"len":3,"mean":"★/ 복,와상","theme":1,"type":1,"x":5,"y":1},{"count":0,"dir":1,"len":2,"mean":"★/ 운,와","theme":1,"type":1,"x":6,"y":0}],"6,3":[{"count":0,"dir":0,"len":2,"mean":"★/ 복,창","theme":1,"type":1,"x":6,"y":3},{"count":0,"dir":1,"len":4,"mean":"★/ 복,식탁구","theme":1,"type":1,"x":6,"y":3}],"6,4":[{"count":0,"dir":0,"len":2,"mean":"★/ 음,식","theme":1,"type":1,"x":5,"y":4},{"count":0,"dir":1,"len":4,"mean":"★/ 복,식탁구","theme":1,"type":1,"x":6,"y":3}],"6,5":[{"count":0,"dir":1,"len":4,"mean":"★/ 복,식탁구","theme":1,"type":1,"x":6,"y":3}],"6,6":[{"count":0,"dir":0,"len":2,"mean":"★/ 수,구","theme":1,"type":1,"x":5,"y":6},{"count":0,"dir":1,"len":4,"mean":"★/ 복,식탁구","theme":1,"type":1,"x":6,"y":3}],"7,1":[{"count":0,"dir":0,"len":3,"mean":"★/ 복,와상","theme":1,"type":1,"x":5,"y":1},{"count":0,"dir":1,"len":3,"mean":"★/ 상,수창","theme":1,"type":1,"x":7,"y":1}],"7,2":[{"count":0,"dir":1,"len":3,"mean":"★/ 상,수창","theme":1,"type":1,"x":7,"y":1}],"7,3":[{"count":0,"dir":0,"len":2,"mean":"★/ 복,창","theme":1,"type":1,"x":6,"y":3},{"count":0,"dir":1,"len":3,"mean":"★/ 상,수창","theme":1,"type":1,"x":7,"y":1}]},{"0,0":[{"count":0,"dir":0,"len":3,"mean":"★/ 상,상력","theme":1,"type":1,"x":0,"y":0}],"0,3":[{"count":0,"dir":0,"len":2,"mean":"★/ 막,하","theme":1,"type":1,"x":0,"y":3},{"count":0,"dir":1,"len":3,"mean":"★/ 막,잡이","theme":1,"type":1,"x":0,"y":3}],"0,4":[{"count":0,"dir":1,"len":3,"mean":"★/ 막,잡이","theme":1,"type":1,"x":0,"y":3}],"0,5":[{"count":0,"dir":0,"len":2,"mean":"★/ 이,이","theme":1,"type":1,"x":0,"y":5},{"count":0,"dir":1,"len":3,"mean":"★/ 막,잡이","theme":1,"type":1,"x":0,"y":3}],"1,0":[{"count":0,"dir":0,"len":3,"mean":"★/ 상,상력","theme":1,"type":1,"x":0,"y":0},{"count":0,"dir":1,"len":4,"mean":"★/ 상,고각하","theme":1,"type":1,"x":1,"y":0}],"1,1":[{"count":0,"dir":1,"len":4,"mean":"★/ 상,고각하","theme":1,"type":1,"x":1,"y":0}],"1,2":[{"count":0,"dir":0,"len":3,"mean":"★/ 각,저도","theme":1,"type":1,"x":1,"y":2},{"count":0,"dir":1,"len":4,"mean":"★/ 상,고각하","theme":1,"type":1,"x":1,"y":0}],"1,3":[{"count":0,"dir":0,"len":2,"mean":"★/ 막,하","theme":1,"type":1,"x":0,"y":3},{"count":0,"dir":1,"len":4,"mean":"★/ 상,고각하","theme":1,"type":1,"x":1,"y":0}],"1,5":[{"count":0,"dir":0,"len":2,"mean":"★/ 이,이","theme":1,"type":1,"x":0,"y":5},{"count":0,"dir":1,"len":2,"mean":"★/ 이,명","theme":1,"type":1,"x":1,"y":5}],"1,6":[{"count":0,"dir":0,"len":2,"mean":"★/ 명,수","theme":1,"type":1,"x":1,"y":6},{"count":0,"dir":1,"len":2,"mean":"★/ 이,명","theme":1,"type":1,"x":1,"y":5}],"2,0":[{"count":0,"dir":0,"len":3,"mean":"★/ 상,상력","theme":1,"type":1,"x":0,"y":0}],"2,2":[{"count":0,"dir":0,"len":3,"mean":"★/ 각,저도","theme":1,"type":1,"x":1,"y":2}],"2,6":[{"count":0,"dir":0,"len":2,"mean":"★/ 명,수","theme":1,"type":1,"x":1,"y":6}],"3,2":[{"count":0,"dir":0,"len":3,"mean":"★/ 각,저도","theme":1,"type":1,"x":1,"y":2},{"count":0,"dir":1,"len":3,"mean":"★/ 도,지사","theme":1,"type":1,"x":3,"y":2}],"3,3":[{"count":0,"dir":1,"len":3,"mean":"★/ 도,지사","theme":1,"type":1,"x":3,"y":2}],"3,4":[{"count":0,"dir":0,"len":3,"mean":"★/ 사,다트","theme":1,"type":1,"x":3,"y":4},{"count":0,"dir":1,"len":3,"mean":"★/ 도,지사","theme":1,"type":1,"x":3,"y":2}],"4,4":[{"count":0,"dir":0,"len":3,"mean":"★/ 사,다트","theme":1,"type":1,"x":3,"y":4},{"count":0,"dir":1,"len":3,"mean":"★/ 다,리미","theme":1,"type":1,"x":4,"y":4}],"4,5":[{"count":0,"dir":1,"len":3,"mean":"★/ 다,리미","theme":1,"type":1,"x":4,"y":4}],"4,6":[{"count":0,"dir":0,"len":3,"mean":"★/ 미,디어","theme":1,"type":1,"x":4,"y":6},{"count":0,"dir":1,"len":3,"mean":"★/ 다,리미","theme":1,"type":1,"x":4,"y":4}],"5,0":[{"count":0,"dir":0,"len":3,"mean":"★/ 횡,취곡","theme":1,"type":1,"x":5,"y":0}],"5,3":[{"count":0,"dir":0,"len":2,"mean":"★/ 로,진","theme":1,"type":1,"x":5,"y":3},{"count":0,"dir":1,"len":2,"mean":"★/ 로,트","theme":1,"type":1,"x":5,"y":3}],"5,4":[{"count":0,"dir":0,"len":3,"mean":"★/ 사,다트","theme":1,"type":1,"x":3,"y":4},{"count":0,"dir":1,"len":2,"mean":"★/ 로,트","theme":1,"type":1,"x":5,"y":3}],"5,6":[{"count":0,"dir":0,"len":3,"mean":"★/ 미,디어","theme":1,"type":1,"x":4,"y":6}],"6,0":[{"count":0,"dir":0,"len":3,"mean":"★/ 횡,취곡","theme":1,"type":1,"x":5,"y":0}],"6,2":[{"count":0,"dir":0,"len":2,"mean":"★/ 사,수","theme":1,"type":1,"x":6,"y":2},{"count":0,"dir":1,"len":2,"mean":"★/ 사,진","theme":1,"type":1,"x":6,"y":2}],"6,3":[{"count":0,"dir":0,"len":2,"mean":"★/ 로,진","theme":1,"type":1,"x":5,"y":3},{"count":0,"dir":1,"len":2,"mean":"★/ 사,진","theme":1,"type":1,"x":6,"y":2}],"6,6":[{"count":0,"dir":0,"len":3,"mean":"★/ 미,디어","theme":1,"type":1,"x":4,"y":6},{"count":0,"dir":1,"len":2,"mean":"★/ 어,장","theme":1,"type":1,"x":6,"y":6}],"6,7":[{"count":0,"dir":0,"len":2,"mean":"★/ 장,사","theme":1,"type":1,"x":6,"y":7},{"count":0,"dir":1,"len":2,"mean":"★/ 어,장","theme":1,"type":1,"x":6,"y":6}],"7,0":[{"count":0,"dir":0,"len":3,"mean":"★/ 횡,취곡","theme":1,"type":1,"x":5,"y":0},{"count":0,"dir":1,"len":3,"mean":"★/ 곡,호수","theme":1,"type":1,"x":7,"y":0}],"7,1":[{"count":0,"dir":1,"len":3,"mean":"★/ 곡,호수","theme":1,"type":1,"x":7,"y":0}],"7,2":[{"count":0,"dir":0,"len":2,"mean":"★/ 사,수","theme":1,"type":1,"x":6,"y":2},{"count":0,"dir":1,"len":3,"mean":"★/ 곡,호수","theme":1,"type":1,"x":7,"y":0}],"7,7":[{"count":0,"dir":0,"len":2,"mean":"★/ 장,사","theme":1,"type":1,"x":6,"y":7}]}]);

        expect(result).toBe('①②③④⑤⑥⑦⑧⑨⑩');
        done();
    })
})

test('game.started 가 true 일때 roundReady 테스트', () => {
    const room = {
        game: {
            started: true
        },
        roundEnd: jest.fn()
    };

    const game = new crossword(undefined, undefined, room);
    game.roundReady();

    expect(room.roundEnd).toHaveBeenCalledTimes(1);
});

test('game.started 가 false 일때 roundReady 테스트', () => {
    jest.useFakeTimers();
    jest.spyOn(global, 'setTimeout');

    const room = {
        game: {
            started: false,
            seq: ['player1', 'player2']
        },
        time: 10,
        byMaster: jest.fn(),
        turnStart: jest.fn()
    };

    const game = new crossword(undefined, undefined, room);
    game.roundReady();

    expect(room.game.started).toBe(true);
    expect(room.game.roundTime).toBe(room.time * 1000);
    expect(room.byMaster).toHaveBeenCalledTimes(1);
    expect(room.byMaster).toHaveBeenCalledWith('roundReady', {seq: room.game.seq}, true);
    expect(setTimeout).toHaveBeenCalledTimes(1);
    expect(setTimeout).toHaveBeenLastCalledWith(room.turnStart, 2400);
});

test('turnStart 테스트', () => {
    jest.useFakeTimers();
    jest.spyOn(global, 'setTimeout');

    const room = {
        game: {
            roundTime: 1234,
            boards: { boards: 'boards' },
            means: { means: 'means' },
        },
        byMaster: jest.fn(),
        turnEnd: jest.fn()
    };

    const game = new crossword(undefined, undefined, room);

    game.turnStart();
    expect(room.game.late).toBe(false);

    expect(room.game.roundAt).toBe(jest.now());

    expect(setTimeout).toHaveBeenCalledTimes(1);
    expect(setTimeout).toHaveBeenLastCalledWith(room.turnEnd, room.game.roundTime);
    expect(room.game.qTimer).toBe(setTimeout.mock.results[0].value);

    expect(room.byMaster).toHaveBeenCalledTimes(1);
    expect(room.byMaster).toHaveBeenLastCalledWith('turnStart', {
        boards: room.game.boards,
        means: room.game.means
    }, true);
});

test('turnEnd 테스트', () => {
    jest.useFakeTimers();
    jest.spyOn(global, 'setTimeout');

    const room = {
        game: {},
        byMaster: jest.fn(),
        roundReady: jest.fn()
    };
    const game = new crossword(undefined, undefined, room);

    game.turnEnd();
    expect(room.game.late).toBe(true);

    expect(room.byMaster).toHaveBeenCalledTimes(1);
    expect(room.byMaster).toHaveBeenCalledWith('turnEnd', {});

    expect(setTimeout).toHaveBeenCalledTimes(1);
    expect(setTimeout).toHaveBeenLastCalledWith(room.roundReady, 2500);
    expect(room.game._rrt).toBe(setTimeout.mock.results[0].value);
});

test('data 인수가 제공 되지 않았을때 submit 테스트', () => {
    const room = {
        game: {
            boards: {},
            answers: {},
            mdb: {},
        }
    }
    const game = new crossword(undefined, undefined, room);
    const client = {
        chat: jest.fn()
    }
    const text = 'some text'

    game.submit(client, text, undefined);

    expect(client.chat).toHaveBeenCalledTimes(1);
    expect(client.chat).toHaveBeenCalledWith(text);
});

test('플레이 상태가 아닐때 submit 테스트', () => {
    const room = {
        game: {
            boards: {},
            answers: {},
            mdb: {},
        }
    }
    const game = new crossword(undefined, undefined, room);
    const client = {
        chat: jest.fn(),
        robot: false,
    }
    const text = 'some text'

    game.submit(client, text, {});

    expect(client.chat).toHaveBeenCalledTimes(1);
    expect(client.chat).toHaveBeenCalledWith(text);
});

test('정답을 맞추지 못했을때 submit 테스트', () => {
    const room = {
        game: {
            boards: {},
            answers: {
                '0,6,2,1': 'apple1'
            },
            mdb: [{}],
            seq: ['player1']
        }
    };
    const game = new crossword(undefined, undefined, room);
    const client = {
        id: 'player1',
        send: jest.fn()
    };
    const text = 'apple';

    // [boardNumber, x, y, dir]
    game.submit(client, text, [0, '6', '2', '1']);

    expect(client.send).toHaveBeenCalledTimes(1);
    expect(client.send).toHaveBeenCalledWith('turnHint', { value: text })
});

test('정답을 맞췄을때 submit 테스트', () => {
    jest.useFakeTimers();

    const pos = [0, '6', '2', '0'];
    const key = pos.join(',');
    const room = {
        game: {
            boards: {},
            answers: {
                [key]: 'abc',
                ['0,8,2,1']: 'case'
            },
            mdb: [{
                '6,2': [
                    {x: 6, y: 2, dir: 0, count: 0, len: 3}, // abc
                    {x: 6, y: 2, dir: 1, count: 0, len: 4}
                ],
                '7,2': [
                    {x: 6, y: 2, dir: 0, count: 0, len: 3} // abc
                ],
                '8,2': [
                    {x: 6, y: 2, dir: 0, count: 0, len: 3}, // abc
                    {x: 8, y: 2, dir: 1, count: 3, len: 4}
                ]
            }],
            seq: ['player1'],
            prisoners: {},
            numQ: 1,
            qTimer: setTimeout(() => {}, 1000),
        },
        submit: jest.fn(),
        turnEnd: jest.fn(),
    };

    jest.spyOn(global, 'setTimeout');
    jest.spyOn(global, 'clearTimeout');

    const game = new crossword(undefined, undefined, room);
    const client = {
        id: 'player1',
        send: jest.fn(),
        game: { score: 100 },
        publish: jest.fn(),
        invokeWordPiece: jest.fn()
    };
    const text = 'abc';

    // [boardNumber, x, y, dir]
    game.submit(client, text, pos);

    expect(room.game.prisoners[key]).toBe(text);
    expect(room.game.answers[key]).toBe(false);

    expect(setTimeout).toHaveBeenCalledTimes(1);
    expect(setTimeout).toHaveBeenLastCalledWith(room.submit, 1, client, 'case', [0, 8, 2, 1]);

    expect(client.game.score).toBe(100 + text.length * 10);
    expect(client.publish).toHaveBeenCalledTimes(1);
    expect(client.publish).toHaveBeenLastCalledWith('turnEnd', {
        target: client.id,
        pos: pos,
        value: text,
        score: text.length * 10
    });

    expect(client.invokeWordPiece).toHaveBeenCalledTimes(1);
    expect(client.invokeWordPiece).toHaveBeenLastCalledWith(text, 1.2);

    expect(clearTimeout).toHaveBeenCalledTimes(1);
    expect(clearTimeout).toHaveBeenLastCalledWith(room.game.qTimer);

    expect(room.turnEnd).toHaveBeenCalledTimes(1);
});