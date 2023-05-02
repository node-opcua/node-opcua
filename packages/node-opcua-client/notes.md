


# reconnection


# reconnectOnFailure

gotcha: 
reconnectOnFailure requires  connectionStrategy.maxRetry > 0 or connectionStrategy.maxRetry === -1
if connectionStrategy.maxRetry === 0, then there will be no attempt to reconnection in case of connection failure





   socket
       secureChannel
           client
              session


client
```

secureChannel.on("close", (err?: Error | null) => {
    debugLog(chalk.yellow.bold(" ClientBaseImpl emitting close"), err?.message);
    this._destroy_secure_channel();
    if (!err || !this.reconnectOnFailure) {
        // this is a normal close operation initiated by us
        this.emit("close", err); // client cannot be used any more
    } else {
        if (this.reconnectOnFailure && this._internalState !== "reconnecting") {
            this.emit("connection_lost", err?.message); 
            this._repairConnection();
        }
    }
});


_repairConnection
    * check for no reentrancy=> ignore if rentrant
    * this._inside_repairConnection = false;                
     __recreate_secure_channel
         * if err:
                this._inside_repairConnection = false;                
               this.emit("close", err1);
               this._setInternalState("disconnected");
               => done!
         * else 
               _finalReconnectionStep
                    _on_connection_reestablished   
                        * if err 
                            this._inside_repairConnection = false;
                            this._destroy_secure_channel();
                            setTimeout(() => this._repairConnection(), OPCUAClientBase.retryDelay);
                        * else:
                                this.emit("connection_reestablished");
                                this._setInternalState("connected");
                                => done !

```
