let roomInstance = null

const startGameSessionController = {
    setRoomInstance: (instance) => {
        roomInstance = instance
    },

    startGame: async (req, res) => {
        const { team, players, room, book_room_until } = req.body

        //console.log("Received Payload:", req.body)

        if (!room || !players) {
            return res.status(400).json({ error: 'Missing data'})
        }

        const [roomType, rule, level] = room.split(',')

        if (!roomType || !rule || !level || !players.length) {
            return res.status(400).json({ error: 'Invalid room format or missing players' });
        }

        await roomInstance.startGame(roomType, rule, level, players, team, book_room_until)

        res.json({ message: `Game started in ${roomType} with rule: ${rule}, level: ${level}` });
    }
}

export default startGameSessionController