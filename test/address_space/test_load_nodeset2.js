var generate_address_space = require("../../lib/address_space/load_nodeset2").generate_address_space;
var AddressSpace = require("../../lib/address_space/address_space").AddressSpace;
var should = require("should");

describe("testing NodeSet XML file loading",function(){


    var address_space;

    beforeEach(function(){

        address_space = new AddressSpace();
        Object.keys(address_space._aliases).length.should.equal(0);
        Object.keys(address_space._objectMap).length.should.equal(0);
        Object.keys(address_space._variableTypeMap).length.should.equal(0);
        Object.keys(address_space._referenceTypeMap).length.should.equal(0);
        Object.keys(address_space._dataTypeMap).length.should.equal(0);
        Object.keys(address_space._objectTypeMap).length.should.equal(0);
    });

    it("should load a nodeset xml file",function(done){


        var xml_file = __dirname + "/../../lib/server/mini.Node.Set2.xml";

        require("fs").existsSync(xml_file).should.be.eql(true);

        generate_address_space(address_space,xml_file,function(err){

            Object.keys(address_space._aliases).length.should.be.greaterThan(10);
            Object.keys(address_space._objectMap).length.should.be.greaterThan(10);
            Object.keys(address_space._variableTypeMap).length.should.be.greaterThan(3);
            Object.keys(address_space._referenceTypeMap).length.should.be.greaterThan(10);
            Object.keys(address_space._dataTypeMap).length.should.be.greaterThan(2);
            Object.keys(address_space._objectTypeMap).length.should.be.greaterThan(1);
            done(err);
        })
    });

    it("should load a large nodeset xml file",function(done){


        this.timeout(10000);

        var xml_file = __dirname + "/../../nodesets/Opc.Ua.NodeSet2.xml";
        require("fs").existsSync(xml_file).should.be.eql(true);

        generate_address_space(address_space,xml_file,function(err){

            Object.keys(address_space._aliases).length.should.be.greaterThan(10);
            Object.keys(address_space._objectMap).length.should.be.greaterThan(10);
            Object.keys(address_space._variableTypeMap).length.should.be.greaterThan(10);
            Object.keys(address_space._referenceTypeMap).length.should.be.greaterThan(10);
            Object.keys(address_space._dataTypeMap).length.should.be.greaterThan(10);
            Object.keys(address_space._objectTypeMap).length.should.be.greaterThan(10);
            done(err);
        })
    });


});
