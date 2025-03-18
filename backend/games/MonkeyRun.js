import Game from '../classes/Game.js'

export default class MonkeyRun extends Game {
    constructor (players, rule, level, team, book_room_until, env, roomInstance) {
        super(players, rule, level, team, book_room_until, env)
        this.roomInstance = roomInstance;
        this.running = false;
        this.timer = null;
    }

    start() {
        super.start()
        this.running = true;
        let nicknames = `${this.players.map(p => p.nick_name).join(", ")}`
        console.log(`${nicknames} is running!`)

        this.timer = setInterval(() => {
            if (!this.roomInstance.enabled) {
                this.stop();
            } else {
                console.log(`${nicknames} is still running...`);
            }
        }, 1000);
    }

    stop() {
        if (this.running) {
            this.running = false
            clearInterval(this.timer)
            console.log('Game has been stopped')
        }
    }
}