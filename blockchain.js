const db = require('node-localdb');
const crypto = require('crypto');
const secret = 'blocxus';

class Block{
    constructor(id,data,pHash){
        let block = {
            id: id,
            data: data,
            pHash: pHash
        };
        block.hash = Block.toHash(block);
        return block
    }
    static toHash(block){
        return crypto.createHmac('sha256', secret).update(JSON.stringify(block)).digest('hex');
    }
}
class Blockchain{
    constructor(blocks_directory){
        this.blocks = db(blocks_directory+'/blocks.json');
        this.genesis = new Block(0,'Hello BlocXus');
    }
    async init(){
        let chain = await this.getChain();
        if(chain.length===0){
            this.previous = this.genesis;
            this.addBlock(this.genesis);
        }
        else {
            this.previous = chain[chain.length-1];
        }
    }
    async mineBlock(data){
        if(!this.previous){
            await this.init();
        }
        let block = new Block(this.previous.id+1,data,this.previous.hash);
        await this.addBlock(block);
        return block;
    }
    async receiveBlock(block){
        if(block.id<=this.previous.id){
            return "ERR"
        }
        if(block.id===this.previous.id){
            return "HMM"
        }
        if(block.pHash===this.previous.hash){
            await this.addBlock(block);
            return "NEXT"
        }
        else{
            return "GET_CHAIN"
        }
    }
    async receiveChain(chain){
        if(chain.length <= await this.blocks.count({})){
            return "ERR"
        }
        if(chain.length === await this.blocks.count({})){
            return "HMM"
        }
        this.blocks._flush(chain);
        this.previous = chain[chain.length-1];
        return "NEXT"
    }
    async addBlock(block){
        await this.blocks.insert(block);
        this.previous = block;
    }
    async getChain(){
        return await this.blocks.find({});
    }
}

module.exports=Blockchain;