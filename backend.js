const fs = require('fs');const blockchain = require('./blockchain');const dgram = require('dgram');const pmp = require('nat-pmp');const natUpnp = require('nat-upnp');const getIP = require('external-ip')({services: ['http://ifconfig.co/x-real-ip', 'http://ifconfig.io/ip']});const internalIp = require('internal-ip');const gateway = require('default-gateway');class UDPConnection{    constructor(host,port){        this.host = host;        this.port = port;    }}class Node{    constructor(){        this.peers = [];        this.onUpdate = null;    }    async start(blocks_directory=process.cwd()+'./blocks/',known_peer=false,port=8080) {        getIP((err, ip) => {            if (err) {                console.log("Hmm Error");            }            console.log("Your ip address is "+ip);        });        let upnpClient = natUpnp.createClient();        let pmpClient = pmp.connect((await gateway.v4()).gateway||(await gateway.v6()).gateway);        let protocols = ['udp', 'tcp'];        protocols.forEach(function(protocol) {            upnpClient.portMapping({                public: port,                private: port,                protocol: protocol,                description: 'Blocxus',                ttl: 64 // Unlimited, since most routers doesn't support other value            }, function(err) {});            upnpClient.externalIp(function(err, ip) {                console.log("UPNP IP: "+ip)            });            pmpClient.portMapping({                private: port,                public: port,                type: protocol,                ttl: 60 * 30            }, function(err) {});            pmpClient.externalIp(function (err, info) {                console.log('PMP IP: ', info);            });        });        let self = this;        this.blocks_directory = blocks_directory;        this.server = dgram.createSocket('udp4');        //console.log(this.server);        this.blocks = new blockchain(blocks_directory);        if(!fs.existsSync(blocks_directory)){            fs.mkdirSync(blocks_directory);        }        if(known_peer){            this.connectToNode(known_peer)        }        this.server.on('message', function(message, remote){            //console.log(JSON.parse(message.toString()));            self.onMessage(JSON.parse(message.toString()),new UDPConnection(remote.address,remote.port));        });        this.server.on('listening', function () {            let address = self.server.address();            console.log('Node listening on ' + address.address + ":" + address.port);        });        this.server.bind(port, "0.0.0.0");    };    async onMessage(message,conn){        switch (message.type){            case "DISCOVER":                this.peers.forEach((peer)=>{this.write(conn,{type:"CONNECT",conn:[peer.host,peer.port]})});                break;            case "CONNECT":                if(message.conn){                    this.initConnection(new UDPConnection(message.conn[0],message.conn[1]));                }                else {                    this.initConnection(conn);                }                break;            case "BLOCK":                switch (await this.blocks.receiveBlock(message.block)){                    case "NEXT":                        this.broadcast({type:"BLOCK",block:message.block});                        if(this.onUpdate){                            this.onUpdate({type:"BLOCK",blocks:this.blocks});                        }                        break;                    case "GET_CHAIN":                        this.write(conn,{type:"GET_CHAIN"});                        break;                    case "ERR":                        this.write(conn,{type:"BLOCK",block:this.blocks.previous});                        break;                    default:                        //console.log("Skipped");                        break;                }                break;            case "CHAIN_DATA":                if(!fs.existsSync(this.blocks_directory+'/chain-'+message.stamp+'/')){                    fs.mkdirSync(this.blocks_directory+'/chain-'+message.stamp+'/');                }                fs.writeFileSync(this.blocks_directory+'/chain-'+message.stamp+'/'+message.block.id+'.json',JSON.stringify(message.block),"utf-8");                break;            case "CHAIN_END":                this.toChain(message,conn);                break;            case "CHAIN":                switch (await this.blocks.receiveChain(message.chain)){                    case "NEXT":                        let chain = await this.blocks.getChain();                        this.peers.forEach(async(peer)=>{await this.sendChain(peer,chain)});                        if(this.onUpdate){                            this.onUpdate({type:"CHAIN",blocks:this.blocks});                        }                        break;                    case "ERR":                        this.write(conn,{type:"BLOCK",block:this.blocks.previous});                        break;                    default:                        //console.log("Skipped");                        break;                }                break;            case "GET_CHAIN":                let chain2 = await this.blocks.getChain();                await this.sendChain(conn,chain2);                break;            case "GET_BLOCK":                this.write(conn,{type:"BLOCK",block:await this.blocks.previous});                break;        }    };    broadcast(message){        this.peers.forEach((peer)=>{this.write(peer,message)})    };    async toChain(message,conn){        let chain3 = [];        for(let i =0;i<message.last;i++){            chain3.push(JSON.parse(fs.readFileSync(this.blocks_directory+'/chain-'+message.stamp+'/'+i+'.json',"utf-8")));            //fs.unlinkSync(this.blocks_directory+'/chain-'+message.stamp+'/'+i+'.json');        }        console.log('length: '+chain3.length);        this.onMessage({type:"CHAIN",chain:chain3},conn);    }    write(peer, message) {        let msg = new Buffer(JSON.stringify(message));        this.server.send(msg,0,msg.length,peer.port,peer.host)    };    initConnection(connection) {        this.peers.push(connection);        if(this.onUpdate){            this.onUpdate({type:"PEER",peer:connection});        }        this.write(connection,{type:"GET_BLOCK"});    };    async discoverNode(){        this.broadcast({type:"DISCOVER"})    };    async getUpdate(){        this.broadcast({type:"GET_BLOCK"});    };    async downloadChain(){        this.broadcast({type:"GET_CHAIN"});    };    async mineBlock(data){        let block = await this.blocks.mineBlock(data);        this.broadcast({type:"BLOCK",block:block});        if(this.onUpdate){            this.onUpdate({type:"MINED",block:block});        }    };    async connectToNode(nodeInfo){        this.write(new UDPConnection(nodeInfo.ip,nodeInfo.port),{type:"CONNECT"});        this.initConnection(new UDPConnection(nodeInfo.ip,nodeInfo.port));        /*let socket = net.connect(nodeInfo.port, nodeInfo.ip, () => this.ex.connect(socket,(err,connection)=>{            if(err){return}            this.initConnection(connection)        }));*/    };    async sendChain(peer, chain) {        let stamp = `${this.server.address().address}-${Date.now().toString()}-${Math.random()}`;        for (let i =0;i<chain.length;i++){            this.write(peer,{type:"CHAIN_DATA",block:chain[i],stamp:stamp});            console.log('i: '+i);        }        this.write(peer,{type:"CHAIN_END",stamp:stamp,last:chain.length});    }}module.exports = new Node();