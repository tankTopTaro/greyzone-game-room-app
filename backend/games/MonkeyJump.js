import Game from '../classes/Game.js'

export default class MonkeyJump extends Game {
    constructor (player, env) {
        super(player, env)
    }

    start() {
        super.start()
        console.log(`${this.player} is jumping!`)
    }
}