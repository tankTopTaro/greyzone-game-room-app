import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import getAvailableGames from '../utils/getAvailableGames.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const GAMES_DIR = path.join(__dirname, '../games')
const DB_PATH = path.join(__dirname, '../assets/db/db.json')

export default class GameManager {
    constructor(env) {
        this.env = env
    }

    async loadGame(roomInstance, roomType, rule, level, players, team, book_room_until, is_collaborative, timeToPrepare) {
        try {
            console.log('PLAYERS:');
            players.forEach(player => {
               console.log({
                  id: player.id,
                  nick_name: player.nick_name,
                  first_name: player.first_name,
                  last_name: player.last_name,
                  gender: player.gender,
                  birth_date: player.birth_date,
                  league: player.league,
                  facility_session: player.facility_session,
                  games_history: player.games_history
               })
            })
            console.log('TEAM:', team)
            console.log(`GAME INFO: ${roomType} > ${rule} > ${level}`)
            console.log('BOOK ROOM UNTIL: ', book_room_until, ' DATE NOW: ', new Date().toISOString().replace('T', ' ').slice(0, 19))
            console.log('IS COLLABORATIVE: ', is_collaborative)
            console.log('TIME TO PREPARE: ', timeToPrepare)

            // get all available game files
            const availableGames = getAvailableGames()

            // find a case-insensitive match for roomType
            const matchedGame = availableGames.find(game => game.toLowerCase() === roomType.toLowerCase())

            if (!matchedGame) throw new Error(`Game ${roomType} not found.`)

            const gamePath = path.join(GAMES_DIR, `${matchedGame}.js`)

            console.log(`Loading game: ${gamePath}`)

            const { default: GameClass } = await import(`file://${gamePath}`)

            const gameInstance = new GameClass(rule, level, players, team, book_room_until, is_collaborative, roomInstance, undefined, timeToPrepare)

            const result = await gameInstance.init()

            if (result !== true) {
                console.log('Game failed to initialize properly')
                return null
            }

            return gameInstance
        } catch (error) {
            console.error(error)
            return null
        }
    }
}