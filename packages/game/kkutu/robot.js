class Robot {
  constructor(target, place, level, DIC) {
    this.DIC = DIC;

    this.id = target + place + Math.floor(Math.random() * 1000000000);
    this.robot = true;
    this.game = {};
    this.data = {};
    this.place = place;
    this.target = target;
    this.equip = { robot: true };

    this.setLevel(level);
    this.setTeam(0);
  }
  
  getData() {
    return {
      id: this.id,
      robot: true,
      game: this.game,
      data: this.data,
      place: this.place,
      target: this.target,
      equip: this.equip,
      level: this.level,
      ready: true
    };
  }

  setLevel(level) {
    this.level = level;
    this.data.score = Math.pow(10, level + 2);
  }

  setTeam(team) {
    this.game.team = team;
  }

  publish(type, data, noBlock) {
    if (this.target == null) {
      for (const i in this.DIC) {
        if (this.DIC[i].place == this.place) this.DIC[i].send(type, data);
      }
    } else if (this.DIC[this.target]) {
      this.DIC[this.target].send(type, data);
    }
  }

  chat(msg, code) {
    this.publish('chat', { value: msg });
  }

  send() {}
  obtain() {}
  invokeWordPiece(text, coef) {}
}

module.exports = Robot;