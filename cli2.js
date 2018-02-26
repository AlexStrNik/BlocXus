const dgram = require('dgram');
const net = require('net');
const stun = require('vs-stun');

let clientName = process.argv[4];
let remoteName = process.argv[5];

const rendezvous = {
    address: process.argv[2],
    port: process.argv[3]
};

const client = {
    ack: false,
    connection: {}
};

const udp_in = dgram.createSocket('udp4');

const getNetworkIP = function (callback) {
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

const send = function (connection, msg, cb) {
    const data = new Buffer(JSON.stringify(msg));

    udp_in.send(data, 0, data.length, connection.port, connection.address, function (err, bytes) {
        if (err) {
            //udp_in.close();
            //console.log('# stopped due to error: %s', err);
        } else {
            console.log('# sent %s to %s:%s', msg.type, connection.address, connection.port);
            if (cb) cb();
        }
    });
};

udp_in.on("listening", function() {
    const linfo = {port: udp_in.address().port};
    getNetworkIP(function(error, ip) {
        if (error) return console.log("! Unable to obtain connection information! "+error);
        linfo.address = ip;
        console.log('# listening as %s@%s:%s', clientName, linfo.address, linfo.port);
        send(rendezvous, { type: 'register', name: clientName, linfo: linfo }, function() {
            if (remoteName) {
                send(rendezvous, { type: 'connect', from: clientName, to: remoteName });
            }
        });
    });
});

udp_in.on('message', function(data, rinfo) {
    try {
        data = JSON.parse(data);
    } catch (e) {
        console.log('! Couldn\'t parse data(%s):\n%s', e, data);
        return;
    }
    if (data.type === 'connection') {
        console.log('# connecting with %s@[%s:%s | %s:%s]', data.client.name,
            data.client.connections.local.address, data.client.connections.local.port, data.client.connections.public.address, data.client.connections.public.port);
        remoteName = data.client.name;
        const punch = {type: 'punch', from: clientName, to: remoteName};
        for (let con in data.client.connections) {
            doUntilAck(1000, function() {
                try{
                    send(data.client.connections[con], punch);
                }
                catch (e){}
            });
        }
    } else if (data.type === 'punch' && data.to === clientName) {
        const ack = {type: 'ack', from: clientName};
        console.log("# got punch, sending ACK");
        send(rinfo, ack);
    } else if (data.type === 'ack' && !client.ack) {
        client.ack = true;
        client.connection = rinfo;
        console.log("# got ACK, sending MSG");
        send(client.connection, {
            type: 'message',
            from: clientName,
            msg: 'Hello World, '+remoteName+'!'
        });
    } else if (data.type === 'message') {
        console.log('> %s [from %s@%s:%s]', data.msg, data.from, rinfo.address, rinfo.port)
    }
});


let doUntilAck = function(interval, fn) {
    if (client.ack) return;
    fn();
    setTimeout(function() {
        doUntilAck(interval, fn);
    }, interval);
};
udp_in.bind();
