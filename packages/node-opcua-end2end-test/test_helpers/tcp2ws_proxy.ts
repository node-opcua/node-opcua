import * as ws_module from 'ws';
import * as net from 'net';

class Tcp2WSProxyConnection {
    protected sReady = true;
    protected wsReady = false;
	wsBuffer: Buffer[] = [];
    sBuffer : Uint8Array[] = [];
    
    constructor(private s: net.Socket, private ws: ws_module) {

    }

    protected flushWebsocketBuffer() {
        if(this.wsBuffer.length > 0) {
            this.ws.send(Buffer.concat(this.wsBuffer),{binary: true,mask: true});
        }
        this.wsBuffer = [];
    };

    protected flushSocketBuffer() {
        if(this.sBuffer.length > 0) {
            this.s.write(Buffer.concat(this.sBuffer));
        }
        this.sBuffer = [];
    };

    init() {
       
        this.s.on('close', (had_error) => {
            this.ws.removeAllListeners('close');		
            this.ws.close();
        });
    
        this.ws.on('close', () => {
            this.s.removeAllListeners('close');	
            this.s.end();
        });
    
        this.ws.on('error', (e) => {
            console.log('websocket error');
            console.log(e);
            this.ws.removeAllListeners('close');
            this.s.removeAllListeners('close');
            this.ws.close();
            this.s.end();
        });
    
        this.s.on('error', (e) => {
            console.log('socket error');
            console.log(e);
            this.ws.removeAllListeners('close');
            this.s.removeAllListeners('close');
            this.ws.close();
            this.s.end();
        });
    
        this.s.on('connect', () => {
            this.sReady = true;
            this.flushSocketBuffer();
        });
    
        this.ws.on('open', () => {
            this.wsReady = true;
            this.flushWebsocketBuffer();
        });
    
        this.s.on('data', (data) => {
    
            if(! this.wsReady) {
                this.wsBuffer.push(data);
            } else {
                this.ws.send(data,{binary: true,mask: true});
            }
        });
    
        this.ws.on('message', (m: Uint8Array) => {
            if(!this.sReady) {
                this.sBuffer.push(m);
            } else {
                this.s.write(m);			
            }
        });
    }
}

export class Tcp2WSProxy {
    private server?: net.Server;
    constructor(public readonly listenerPort: number, public readonly remoteHost: string ) {
    }

    start() {
        this.server = net.createServer((s) => {
            var ws = new ws_module(this.remoteHost, {});
            const connection = new Tcp2WSProxyConnection(s,ws);
            connection.init();
        });
        this.server.listen(this.listenerPort);
    }

}