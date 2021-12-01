"use strict";
const should = require("should");
const {OPCUAClient} = require("node-opcua");

async function testCreateSessionResponse(endpointUrl) {

    const client1 = OPCUAClient.create({
        endpointMustExist: false,
        connectionStrategy: {
            maxRetry: 1
        }
    });
    let createSessionResponse = "";
    let createSessionRequest = "";
    client1.on("send_request", (c)=>{
        if (c.constructor.name === "CreateSessionRequest")  {
            createSessionRequest = c;
        }

    });
    client1.on("receive_response", (c)=> {
        if (c.constructor.name === "CreateSessionResponse")  {
            createSessionResponse = c;
        }
    })
    try  {

        await client1.connect(endpointUrl);
    
        const session  = await new Promise((resolve, reject)=>{
            client1._createSession((err,session) =>{
                if (err) { return reject(err) } else { resolve(session);}
            });

        })
        await session.close();
        
    } catch(err) {
        console.log("Error = ",err.message);
        console.log(err);
        return{ createSessionResponse, err};
    }
    finally {
        await client1.disconnect();

    }
    // console.log("c", createSessionResponse.toString());
    return{ createSessionResponse};

}
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

module.exports = function(test) {

    describe("PP1 CreateSessionResponse endpoints", function() {

        it("should receive server endpoint in CreateSessionResponse when endpointUrl user by the client matches a valid endpoint", async () => {

            const endpointUrl = test.endpointUrl;
            //xx console.log("e=", endpointUrl);
            const { createSessionResponse, err }= await testCreateSessionResponse(endpointUrl);
            should.not.exist(err);
            createSessionResponse.serverEndpoints.length.should.eql(9);
            createSessionResponse.serverEndpoints[0].endpointUrl.should.eql(test.endpointUrl);

        });
        it("should receive server endpoint in CreateSessionResponse when endpointUrl used by the client doesn't match a valid endpoint", async () => {

            const match = test.endpointUrl.match(/:([0-9]*)$/);
            const port = parseInt(match[1],10);
            const endpointUrl = `opc.tcp://localhost:${port}`;
            // console.log(endpointUrl);
            const { createSessionResponse, err }= await testCreateSessionResponse(endpointUrl);
            should.not.exist(err);
            createSessionResponse.serverEndpoints.length.should.eql(9);
            createSessionResponse.serverEndpoints[0].endpointUrl.should.eql(test.endpointUrl);
        });

    });

};