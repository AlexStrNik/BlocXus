const dgram = require('dgram');
const net = require('net');
const stun = require('vs-stun');
const pmp = require('nat-pmp');
const natUpnp = require('nat-upnp');
const gateway = require('default-gateway');

class udp4{
    send(connection, msg, cb) {
        const data = new Buffer(JSON.stringify(msg));
        this.udp_in.send(data, 0, data.length, connection.port, connection.address, function (err, bytes) {
            if (err) {
                //udp_in.close();
                console.log('# stopped due to error: %s', err);
            } else {
                console.log('# sent %s to %s:%s', msg.type, connection.address, connection.port);
                if (cb) cb();
            }
        });
    };

    getNetworkIP(callback) {
        let server = { host: 'stun.l.google.com', port: 19302 };
        let socket2 = {host: '127.0.0.1', port: 12345};
        let callbacks = async function ( error, value ) {
            if ( !error ) {
                socket2 = value;
                callback(undefined,socket2.stun.local.host);
                socket2.close();
            }
        };
        stun.connect(server, callbacks);

    };

    static getPublicIP(callback) {
        let server = { host: 'stun.l.google.com', port: 19302 };
        let socket2 = {host: '127.0.0.1', port: 12345};
        let callbacks = async function ( error, value ) {
            if ( !error ) {
                socket2 = value;
                callback(undefined,socket2.stun.public.host);
                socket2.close();
            }
        };
        stun.connect(server, callbacks);

    };

    getNetworkPort(callback) {
        let server = { host: 'stun.l.google.com', port: 19302 };
        let socket2 = {host: '127.0.0.1', port: 12345};
        let callbacks = async function ( error, value ) {
            if ( !error ) {
                socket2 = value;
                callback(undefined,socket2.stun.public.port);
                socket2.close();
            }
        };
        stun.connect(server, callbacks);
    };
    doUntilAck(interval, fn) {
        let self = this;
        if (this.client.ack) return;
        fn();
        setTimeout(function() {
            self.doUntilAck(interval, fn);
        }, interval);
    };
    constructor(rendez_host,rendez_port,client_name){
        this.onConnected = ()=>{};
        this.clientName = '';
        this.rendezvous = '';
        this.client = {
            ack: false,
            connection: {}
        };
        this.udp_in = dgram.createSocket('udp4');
        this.rendezvous = {
            address : rendez_host,
            port : rendez_port
        };
        this.clientName = client_name;
        let self = this;
        this.udp_in.on("listening", function() {
            const linfo = {port: self.udp_in.address().port};
            self.getNetworkIP(async function(error, ip) {
                if (error) return console.log("! Unable to obtain connection information! "+error);
                linfo.address = ip;
                console.log('# listening as %s@%s:%s', self.clientName, linfo.address, linfo.port);
                self.send(self.rendezvous, { type: 'register', name: self.clientName, linfo: linfo }, function() {
                });
            });
        });
        this.udp_in.on('message', async function(data, rinfo) {
            try {
                data = JSON.parse(data);
            } catch (e) {
                console.log('! Couldn\'t parse data(%s):\n%s', e, data);
                return;
            }
            if (data.type == 'connection') {
                console.log('# connecting with %s@[%s:%s | %s:%s]', data.client.name,
                    data.client.connections.public.address, data.client.connections.local.port, data.client.connections.public.address, data.client.connections.public.port);
                let remoteName = data.client.name;
                let conns = [{address:data.client.connections.public.address,port:data.client.connections.public.port},{address:data.client.connections.public.address,port:data.client.connections.local.port}];
                const punch = {type: 'punch', from: self.clientName, to: remoteName};
                for (let con in conns) {
                    self.doUntilAck(1000, function() {
                        try{
                            self.send(conns[con], punch);
                        }
                        catch (e){}
                    });
                }
            } else if (data.type == 'punch' && data.to == self.clientName) {
                const ack = {type: 'ack', from: self.clientName};
                console.log("# got punch, sending ACK");
                self.send(rinfo, ack);
            } else if (data.type == 'ack' && !self.client.ack) {
                self.client.ack = true;
                self.onConnected(rinfo);
            }
            else if(data.type == 'registered'){
                let upnpClient = natUpnp.createClient();
                let pmpClient = pmp.connect((await gateway.v4()).gateway||(await gateway.v6()).gateway);
                let protocols = ['udp', 'tcp'];
                protocols.forEach(function(protocol) {
                    upnpClient.portMapping({
                        public: data.client.connections.public.port,
                        private: data.client.connections.local.port,
                        protocol: protocol,
                        description: 'Blocxus',
                        ttl: 0 // Unlimited, since most routers doesn't support other value
                    }, function(err) {});
                    pmpClient.portMapping({
                        private: data.client.connections.public.port,
                        public: data.client.connections.local.port,
                        description: 'Blocxus',
                        type: protocol,
                        ttl: 60 * 30
                    }, function(err) {});
                });
                console.log(data.msg);
            }
            else {
                console.log(data);
            }
        });
        this.getNetworkPort((error,port)=> {
            if (error) return console.log("! Unable to obtain connection information! " + error);
            self.udp_in.bind(port);
        });
    }
    connect(remoteName) {
        this.send(this.rendezvous, {type: 'connect', from: this.clientName, to: remoteName})
    }
}
module.exports = udp4;