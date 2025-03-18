export default class Game {
    constructor(rule, level, players = [], team, book_room_until, env) {
        this.players = players
        this.rule = rule
        this.level = level
        this.team = team
        this.book_room_until = book_room_until
        this.env = env
    }

    start() {
        console.log(`Starting game: ${this.constructor.name}`);
        console.log(`Players: ${this.players.map(p => p.nick_name).join(", ")}`);
        console.log(`Rule: ${this.rule}, Level: ${this.level}`);
        console.log(`Team: ${this.team ? this.team.name : "None"}`);
        console.log(`Booked until: ${this.book_room_until}`);
    }

    end() {
        console.log(`Ending game: ${this.constructor.name}`)
    }
}