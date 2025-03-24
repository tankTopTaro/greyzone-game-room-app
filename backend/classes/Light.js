export default class Light{
    constructor(id, posX, posY, shape, type, width, height, isAffectedByAnimation) {
        this.id = id
        this.posX = posX
        this.posY = posY
        this.shape = shape
        this.type = type
        this.width = width
        this.height = height
        this.isAffectedByAnimation = isAffectedByAnimation
        this.newInstructionString = undefined
        this.lastHardwareInstructionString = undefined
        this.lastSocketInstructionString = undefined
        this.color = undefined
    }
}