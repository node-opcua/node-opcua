const assert = require("node-opcua-assert").assert;
const path = require("path");
const fs = require("fs");

const address_space = require("node-opcua-address-space");

const PseudoSession = require("node-opcua-address-space").PseudoSession;
const parse_opcua_common = require("../lib/parse_server_common").parse_opcua_common;
const nodesets = require("node-opcua-nodesets");
const should = require("should");


const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing custom nodeset",function() {

    this.timeout(Math.min(30000, this._timeout));

    it("should parse a custom nodeset", async () =>{

        async function parse_xml(nodeset_files) {

            const addressSpace = new address_space.AddressSpace();

            await address_space.generateAddressSpace(addressSpace, nodeset_files);
               
            const pseudoSession = new PseudoSession(addressSpace);
            
            const data =  await parse_opcua_common(pseudoSession);

            addressSpace.dispose();
        }
        const nodeset_files = [
            nodesets.standard_nodeset_file,
            path.join(__dirname,"../../../modeling/my_data_type.xml")
        ];
        fs.existsSync(nodeset_files[0]).should.eql(true);
        fs.existsSync(nodeset_files[1]).should.eql(true);

        await parse_xml(nodeset_files);        
    });

});
