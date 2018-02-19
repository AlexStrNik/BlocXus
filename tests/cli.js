#!/usr/bin/env node
let blocxus = require('blocxus');
const vorpal = require('vorpal')();
const colors = require('colors/safe');
const Table = require('cli-table2');

blocxus.onUpdate = function (update) {
    if(update.type==="BLOCK"){
        const table = new Table({
            style:{border:[],header:[]},
            wordWrap: true,
            colWidths:[30,30]
        });
        table.push([{colSpan:2,content:colors.green.bold("New Block #"+update.blocks.previous.id), hAlign:'center'}]);
        let obj = {};
        obj[`id`] = update.blocks.previous.id;
        obj[`hash`] = update.blocks.previous.hash;
        obj[`previous hash`] = update.blocks.previous.pHash;
        for(let k in obj){
            table.push([k,obj[k]])
        }
        table.push([{colSpan:2,content:colors.green.bold("Block Data"), hAlign:'center'}]);
        for(let k in update.blocks.previous.data){
            table.push([k,update.blocks.previous.data[k]])
        }
        vorpal.log(table.toString());
    }
    if(update.type==="MINED"){
        const table = new Table({
            style:{border:[],header:[]},
            wordWrap: true,
            colWidths:[30,30]
        });
        table.push([{colSpan:2,content:colors.green.bold("Mined Block #"+update.block.id), hAlign:'center'}]);
        let obj = {};
        obj[`id`] = update.block.id;
        obj[`hash`] = update.block.hash;
        obj[`previous hash`] = update.block.pHash;
        for(let k in obj){
            table.push([k,obj[k]])
        }
        table.push([{colSpan:2,content:colors.green.bold("Block Data"), hAlign:'center'}]);
        for(let k in update.block.data){
            table.push([k,update.block.data[k]])
        }
        vorpal.log(table.toString());
    }
    if(update.type==="PEER"){
        vorpal.log(update.peer.host);
    }
};

let connect = vorpal.command('connect <host> <port>', "Connect to a new peer. Eg: connect localhost 2727",{})
    .alias('c')
    .action(function(args, callback) {
        if(args.host && args.port) {
            try{
                blocxus.connectToNode({ip:args.host,port:args.port});
            }
            catch (e){
                vorpal.log("Error");
            }
        }
        callback();
    });
let open = vorpal.command('open <port> <directory>', "Start a new peer. Eg: open 2727 ./blocks",{})
    .alias('o')
    .action(function(args, callback) {
        if(args.port && args.directory) {
            try{
                blocxus.start("blocxus-dev",require('wrtc'),args.directory,false,false,args.port);
                blocxus.blocks.init();
            }
            catch (e){
                vorpal.log("Error");
            }
        }
        callback();
    });
let mine = vorpal.command('mine <message>', "Mine a new block with message. Eg: mine BlocXus",{})
    .alias('m')
    .action(function(args, callback) {
        blocxus.mineBlock({"message":args.message});
        callback();
    });
let hello = function () {
    vorpal.log("Hello BlocXus");
    vorpal.exec("help");
};
vorpal.use(connect).use(open).use(mine).use(hello).delimiter('blocxus~$').show();


