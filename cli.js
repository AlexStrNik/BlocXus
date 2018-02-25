const dgram = require('dgram');
const UdpHolePuncher = require('udp-hole-puncher');
const stun = require('vs-stun');
const vorpal = require('vorpal')();
// eslint-disable-next-line import/no-extraneous-dependencies
let dd = {};
let lPort;
let connect = vorpal.command('connect <host> <port>', "Connect to a new peer. Eg: connect localhost 2727",{})
    .alias('c')
    .action(function(argv, callback) {
        const dataMessages = 10;
        const sendData = () => {
            for (let i = 0; i < dataMessages; i += 1) {
                const data = `message ${i}`;
                console.log(`sending ${data} to ${argv.host}:${argv.port}`);
                const message = new Buffer(data);
                dd.socket.send(message, 0, message.length, argv.port, argv.host);
            }
        };
        if(argv.host && argv.port) {
            dd.puncher.connect(argv.host, argv.port);
            dd.puncher.on('connected', () => {
                console.log(`woohoo, we can talk to ${argv.host}:${argv.port}`);
                sendData();
            });
        }
        callback();
    });

let start = function () {
    let server = { host: 'stun.l.google.com', port: 19302 };
    let socket2 = {host: '0.0.0.0', port: 12345};
    let callback = function callback ( error, value ) {
        if ( !error ) {
            socket2 = value;
            console.log(socket2.stun);
            lPort = socket2.stun.local.port;
            socket2.close();
        }
    };
    stun.connect(server, callback);
    //end stun
    const socket = dgram.createSocket('udp4');
    socket.on('error', (error) => {
        console.error(`socket error:\n${error.stack}`);
        socket.close();
    });
    socket.on('message', (message, rinfo) => {
        const data = message.toString();
        console.log(`receiving ${data} from ${rinfo.address}:${rinfo.port}`);
    });
    socket.on('listening', () => {
        const address = socket.address();
        console.log(`listening at ${address.address}:${address.port}`);
        // puncher configuration
        const puncher = new UdpHolePuncher(socket);
        puncher.on('error', (error) => {
            console.log(`woops, something went wrong: ${error}`);
        });
        dd.puncher = puncher;
    });
    socket.bind(lPort);
    dd.socket = socket;
};

// send data
// socket configuration
// bind socket

vorpal.use(connect).use(start).delimiter('blocxus~$').show();