import dotenv from 'dotenv'

import getAvailableGames from "../utils/getAvailableGames.js"

dotenv.config()

let roomInstance = null

const gamesListController = {
    setRoomInstance: (instance) => {
        roomInstance = instance
    },

    getGames: (req, res) => {
        const availableGames = getAvailableGames()
        const hostname = process.env.HOSTNAME
        res.json({ availableGames, hostname })
    }
}

export default gamesListController