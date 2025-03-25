import express from 'express'
import gameAudioController from '../controllers/gameAudioController.js'

const router = express.Router()

router.get('/:audioName', gameAudioController.getAudio)

export default router