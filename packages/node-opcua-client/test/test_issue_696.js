const {OPCUAClient} = require("..");

let setIntervalCalls = 0;
const realSetInterval = global.setInterval;
let clearIntervalCalls = 0;
const realClearInterval = global.clearInterval;

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("issue 696",function() {

    before(()=> {
        global.setInterval = (...args) => {
            setIntervalCalls++;
            return realSetInterval(...args);
        }
        global.clearInterval = (...args) => {
            clearIntervalCalls++;
            return realClearInterval(...args);
        }
    });
    after(()=>{
        global.setInterval = realSetInterval;
        global.clearInterval = realClearInterval;
    })
    it("should not leak interval if connection failed", async()=>{
        
        async function test() {
            try {
                const client = OPCUAClient.create({ connectionStrategy: { maxRetry: 0 } });
                await client.connect('invalid-proto://test-host');    
            } catch(err) { 
                console.log(err.message);
                throw err;
            }
        }
        test().should.be.rejectedWith(/The connection has been rejected/);
        console.log(`setIntervalCalls ${setIntervalCalls} vs. clearIntervalCalls ${clearIntervalCalls}`);

        setIntervalCalls.should.eql(clearIntervalCalls);
    })
});
