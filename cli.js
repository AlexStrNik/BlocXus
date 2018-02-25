const dgram = require('dgram');
const UdpHolePuncher = require('udp-hole-puncher');
const stun = require('vs-stun');
const vorpal = require('vorpal')();
const gateway = require('default-gateway');
const pmp = require('nat-pmp');
const natUpnp = require('nat-upnp');
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
    let callback = async function callback ( error, value ) {
        if ( !error ) {
            socket2 = value;
            console.log(socket2.stun);
            lPort = socket2.stun.local.port;
            socket2.close();

            let protocols = ['udp', 'tcp'];
            let upnpClient = natUpnp.createClient();
            let pmpClient = pmp.connect((await gateway.v4()).gateway||(await gateway.v6()).gateway);
            protocols.forEach(function(protocol) {
                upnpClient.portMapping({
                    public: socket2.stun.public.port,
                    private: socket2.stun.local.port,
                    protocol: protocol,
                    description: 'Blocxus',
                    ttl: 0 // Unlimited, since most routers doesn't support other value
                }, function(err) {});
                pmpClient.portMapping({
                    private: socket2.stun.local.port,
                    public: socket2.stun.public.port,
                    description: 'Blocxus',
                    type: protocol,
                    ttl: 60 * 30
                }, function(err) {});
            });
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
                puncher.on('reachable', () => {
                    console.log(`woohoo, now we are reachable`);
                });
                dd.puncher = puncher;
            });
            socket.bind(lPort);
            dd.socket = socket;
        }
    };
    stun.connect(server, callback);
    //end stun
};

// send data
// socket configuration
// bind socket

vorpal.use(connect).use(start).delimiter('blocxus~$').show();