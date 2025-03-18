import { WebSocketServer } from "ws"

export default class Socket {
    constructor(port) {
        this.port = port
        this.clientByName = {}
        this.init()
    }

    init() {
        this.socket = new WebSocketServer({ port: this.port, host: 'localhost' })

        this.socket.on('connection', (client, request) => {
            client.clientIp = request.connection.remoteAddress
            client.userAgent = request.headers['user-agent']

            // Expect the first message to contain the hostname
            client.once('message', (message) => {
                try {
                    const data = JSON.parse(message.toString())

                    if(data.hostname) {
                        const hostname = data.hostname

                        if (!this.clientByName[hostname]) {
                            this.clientByName[hostname] = new Set()
                        }

                        this.clientByName[hostname].add(client)

                        this.updateClientData()

                        console.log(`Client registered under hostname: ${hostname}`)

                        // Handle messages from this client
                        client.on('message', (message) => {
                            this.handleClientMessage(message)
                        })

                        // Handle disconnections
                        client.on('close', () => {
                            this.handleClientDisconnect(hostname, client)
                        })
                    }
                } catch (error) {
                    console.error("Invalid message format:", error)
                }
            })
        })

        console.log('WebSocket Server running on port ' + this.port)
    }

    broadcastMessage(hostname, message) {
        if (this.clientByName[hostname]) {
            this.clientByName[hostname].forEach(client => {
                if (client.readyState === 1) {
                    client.send(JSON.stringify(message))
                }
            })
        } else {
            console.log(`No clients connected under hostname: ${hostname}`)
        }
    }

    handleClientMessage(message) {
        try {
            const data = JSON.parse(message.toString())
        } catch (error) {
            console.error('Invalid message format', error)
        }
    }

    handleClientDisconnect(hostname, client) {
        console.log(`Client from ${hostname} disconnected.`)
    
        if (this.clientByName[hostname]) {
            this.clientByName[hostname].delete(client)
            
            if (this.clientByName[hostname].size === 0) {
                delete this.clientByName[hostname] // Fully remove hostname entry
                console.log(`All clients from ${hostname} are disconnected.`)
            }
        }
    
        this.updateClientData() // Ensure updateClientData runs
    }

    updateClientData() {
        console.log('updateClientData')
    }

    getConnectedHostnames() {
        return Object.keys(this.clientByName)
    }
}