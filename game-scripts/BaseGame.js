class BaseGame {
    constructor(room) {
      this.room = room;
    }
  
    onAction(state, context) {
        throw new Error("onAction() 必须实现");
      }

    broadcast() {
      this.room.broadcastState();
    }

    end(results) {
      this.room.endGame(results);
    }
  
    filter(state) {
      return JSON.parse(JSON.stringify(state));
    }
  }

module.exports = BaseGame;