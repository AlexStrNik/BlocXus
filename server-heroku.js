let dgram = require('dgram');
let http = require('http');
let udp_matchmaker = dgram.createSocket('udp4');
let udp_port = process.env.PORT;

let clients = {};

udp_matchmaker.on('listening', function() {
    let address = udp_matchmaker.address();
    console.log('# listening [%s:%s]', address.address, address.port);
});

udp_matchmaker.on('message', function(data, rinfo) {
    try {
        data = JSON.parse(data);
    } catch (e) {
        return console.log('! Couldn\'t parse data (%s):\n%s', e, data);
    }
    if (data.type === 'register') {
        clients[data.name] = {
            name: data.name,
            connections: {
                local: data.linfo,
                public: rinfo
            }
        };
        console.log('# Client registered: %s@[%s:%s | %s:%s]', data.name,
            rinfo.address, rinfo.port, data.linfo.address, data.linfo.port);
    } else if (data.type === 'connect') {
        let couple = [ clients[data.from], clients[data.to] ];
        for (let i=0; i<couple.length; i++) {
            if (!couple[i]) return console.log('Client unknown!');
        }

        for (let i=0; i<couple.length; i++) {
            send(couple[i].connections.public.address, couple[i].connections.public.port, {
                type: 'connection',
                client: couple[(i+1)%couple.length],
            });
        }
    }
});

let send = function(host, port, msg, cb) {
    let data = new Buffer(JSON.stringify(msg));
    udp_matchmaker.send(data, 0, data.length, port, host, function(err, bytes) {
        if (err) {
            udp_matchmaker.close();
            console.log('# stopped due to error: %s', err);
        } else {
            console.log('# sent '+msg.type);
            if (cb) cb();
        }
    });
};
http.createServer().listen(udp_port);
udp_matchmaker.bind(udp_port);