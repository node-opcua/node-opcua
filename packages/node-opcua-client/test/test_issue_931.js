const { OPCUAClient } = require("..");

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("issue #931 investigation", function () {
 
    async function wait(t) {
        return await new Promise((resolve)=> setTimeout(resolve, t));
    }

    it("should be able to disconnect when the client is trying to initially connect to a server", async () => {
        
        const client = OPCUAClient.create({ 
            connectionStrategy: { 
                maxRetry: 100,
                initialDelay: 100, 
                maxDelay: 200,
            } 
        });
        
        let backoffCount = 0;
         client.on("backoff", (retry, next)=> {
            backoffCount++;
           // console.log("backoff", retry, next);
         });
       
         client.connect("opc.tcp://localhost:20000");
         await wait(1000);
         
         backoffCount.should.be.greaterThan(4);

         const refBackoffCount = backoffCount;
         await client.disconnect();
         await wait(1000);
         backoffCount.should.eql(refBackoffCount,"Backoff should stops when disconnect is called while connection is still in progress");
    });
});
