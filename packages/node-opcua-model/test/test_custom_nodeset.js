const assert = require("node-opcua-assert").assert;
const path = require("path");
const fs = require("fs");

const address_space = require("node-opcua-address-space");

const PseudoSession = require("node-opcua-address-space").PseudoSession;
const parse_opcua_common = require("../lib/parse_server_common").parse_opcua_common;
const nodesets = require("node-opcua-nodesets");
const should = require("should");


const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing",function() {

    it("should",function(done){

        function parse_xml(nodeset_files, callback) {

            const addressSpace = new address_space.AddressSpace();

            address_space.generate_address_space(addressSpace, nodeset_files, function (err) {
                const pseudoSession = new PseudoSession(addressSpace);
                parse_opcua_common(pseudoSession,function(err,data){

                    console.log("data= ", data);

                    addressSpace.dispose();
                    callback();
                });

            });

        }
        const nodeset_files = [
            nodesets.standard_nodeset_file,
            path.join(__dirname,"../../../modeling/my_data_type.xml")
        ];
        fs.existsSync(nodeset_files[0]).should.eql(true);
        fs.existsSync(nodeset_files[1]).should.eql(true);

        parse_xml(nodeset_files,function(err,a) {
            done(err);
        });
    });

});
