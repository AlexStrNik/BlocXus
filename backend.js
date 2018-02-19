let exchange = require('peer-exchange');
const net = require('net');
const fs = require('fs');
const blockchain = require('./blockchain');

class Node{
    constructor(){
        this.peers = [];
        this.server = null;
        this.onUpdate = null;
    }
    start(network_id,wrtc,blocks_directory=process.cwd()+'./blocks/',max_known_peers=false,known_peer=false,port=8080) {
        this.blocks = new blockchain(blocks_directory);
        if(!fs.existsSync(blocks_directory)){
            fs.mkdirSync(blocks_directory);
        }
        this.ex = new exchange(network_id, { wrtc: wrtc });
        if(known_peer){
            this.connectToNode(known_peer)
        }
        this.ex.on('connect', (conn) => {
            if(!max_known_peers || this.peers.length<max_known_peers){
                this.ex.getNewPeer((err) => {});
            }
        });
        const server = net.createServer((socket) => {
            if(!max_known_peers || this.ex.peers.length<max_known_peers){
                this.ex.accept(socket,(err,connection)=>{
                    if(err){return}
                    this.initConnection(connection)
                });
            }
        }).listen(port);
    };
    async onMessage(message,conn){
        switch (message.type){
            case "BLOCK":
                switch (await this.blocks.receiveBlock(message.block)){
                    case "NEXT":
                        this.broadcast({type:"BLOCK",block:message.block});
                        if(this.onUpdate){
                            this.onUpdate({type:"BLOCK",blocks:this.blocks});
                        }
                        break;
                    case "GET_CHAIN":
                        this.write(conn,{type:"GET_CHAIN"});
                        break;
                    case "ERR":
                        this.write(conn,{type:"BLOCK",block:message.block});
                        break;
                    default:
                        //console.log("Skipped");
                        break;
                }
                break;
            case "CHAIN":
                switch (await this.blocks.receiveChain(message.chain)){
                    case "NEXT":
                        this.broadcast({type:"CHAIN",chain:message.chain});
                        if(this.onUpdate){
                            this.onUpdate({type:"CHAIN",blocks:this.blocks});
                        }
                        break;
                    case "ERR":
                        this.write(conn,{type:"BLOCK",block:message.block});
                        break;
                    default:
                        //console.log("Skipped");
                        break;
                }
                break;
            case "GET_CHAIN":
                this.write(conn,{type:"CHAIN",chain:await this.blocks.getChain()});
                break;
            case "GET_BLOCK":
                this.write(conn,{type:"BLOCK",block:await this.blocks.previous});
                break;
        }
    };
    broadcast(message){
        this.peers.forEach((peer)=>{this.write(peer,message)})
    };
    write(peer, message) {
        peer.write(JSON.stringify(message));
    };
    initConnection(connection) {
        this.peers.push(connection);
        connection.on('data', data => {
            const message = JSON.parse(data.toString());
            this.onMessage(message,connection);
        });
        if(this.onUpdate){
            this.onUpdate({type:"PEER",peer:connection});
        }
        this.write(connection,{type:"GET_BLOCK"});
        this.write(connection,{type:"GET_BLOCK"});
    };
    async discoverNode(){
        this.ex.getNewPeer((err) => {});
    };
    async getUpdate(){
        this.broadcast({type:"GET_BLOCK"});
    };
    async downloadChain(){
        this.broadcast({type:"GET_CHAIN"});
    };
    async mineBlock(data){
        let block = await this.blocks.mineBlock(data);
        this.broadcast({type:"BLOCK",block:block});
        if(this.onUpdate){
            this.onUpdate({type:"MINED",block:block});
        }
    };
    async connectToNode(nodeInfo){
        let socket = net.connect(nodeInfo.port, nodeInfo.ip, () => this.ex.connect(socket,(err,connection)=>{
            if(err){return}
            this.initConnection(connection)
        }));
    };
}
module.exports = new Node();