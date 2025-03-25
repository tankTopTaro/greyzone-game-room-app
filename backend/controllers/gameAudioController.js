let roomInstance = null

const gameAudioController = {
    setRoomInstance: (instance) => {
        roomInstance = instance
    },

    getAudio: (req, res) => {
      const audio = {
         'levelFailed': 'audio/703542__yoshicakes77__dead.ogg',
         'levelCompleted': 'audio/703543__yoshicakes77__win.ogg',
         'playerScored': 'audio/703541__yoshicakes77__coin.ogg',
         'playerLoseLife': 'audio/253174__suntemple__retro-you-lose-sfx.wav',
         'gameOver': 'audio/76376__deleted_user_877451__game_over.wav',
         '321go': 'audio/474474__bnewton103__robotic-countdown.wav',
         'red': 'audio/196551__margo_heston__red-f.wav',
         'green': 'audio/196520__margo_heston__green-f.wav',
         'blue': 'audio/196535__margo_heston__blue-f.wav',
         'yellow': 'audio/196531__margo_heston__yellow-f.wav',
         'purple': 'audio/196547__margo_heston__purple-f.wav'
     }
     const audioName = req.params.audioName

     if (!audio[audioName]) return res.status(404).json({error: 'Audio not found'})

      res.json({ url: audio[audioName] })
    }
}

export default gameAudioController