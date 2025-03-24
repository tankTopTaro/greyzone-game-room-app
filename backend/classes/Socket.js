import { WebSocketServer } from "ws"

export default class Socket {
    constructor(port) {
        this.port = port
        this.socket = null
        this.clientByName = {}
        this.init()
    }

    init() {
        const host = process.env.HOSTNAME || '0.0.0.0'
        this.socket = new WebSocketServer({ port: this.port, host: host })

        this.socket.on('connection', (client, request) => {
            client.clientIp = request.connection.remoteAddress
            client.userAgent = request.headers['user-agent']

            // Expect the first message to contain the clientname
            client.once('message', (message) => {
                try {
                    const data = JSON.parse(message.toString())

                    if(data.clientname) {
                        const clientName = data.clientname

                        if (!this.clientByName[clientName]) {
                            this.clientByName[clientName] = new Set()
                        }

                        this.clientByName[clientName].add(client)

                        console.log(`Client registered under name: ${clientName}`)

                        // Handle messages from this client
                        client.on('message', (message) => {
                            console.log('Received message from '+data.clientname+' message:'+message.toString())
                        })

                        // Handle disconnections
                        client.on('close', () => {
                            this.handleClientDisconnect(clientName, client)
                        })
                    }
                } catch (error) {
                    console.error("Invalid message format:", error)
                }
            })
        })

        console.log('WebSocket Server running on port ' + this.port)
    }

    broadcastMessage(clientname, message) {
        if (this.clientByName[clientname]) {
            this.clientByName[clientname].forEach(client => {
                if (client.readyState === 1) {
                    client.send(JSON.stringify(message))
                }
            })
        }
    }

    handleClientDisconnect(clientname, client) {
        console.log(`Client from ${clientname} disconnected.`)
    
        if (this.clientByName[clientname]) {
            this.clientByName[clientname].delete(client)
            
            if (this.clientByName[clientname].size === 0) {
                delete this.clientByName[clientname] // Fully remove clientname entry
                console.log(`All clients from ${clientname} are disconnected.`)
            }
        }
    }

    getConnectedclientnames() {
        return Object.keys(this.clientByName)
    }
}