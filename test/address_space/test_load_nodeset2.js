var generate_address_space = require("../../lib/address_space/load_nodeset2").generate_address_space;
var AddressSpace = require("../../lib/address_space/address_space").AddressSpace;


describe("testing NodeSet XML file loading",function(){

    it("should load a nodeset xml file",function(done){

        var address_space = new AddressSpace();

        var xml_file = __dirname + "/../../lib/server/mini.Node.Set2.xml";

        generate_address_space(address_space,xml_file,function(err){
            done(err);
        })
    });


});
