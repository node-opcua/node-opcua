
var Xml2Json = require("../../lib/xml2json/lib").Xml2Json;
var should = require("should");

describe("XMLToJSON",function(){

    it("should parse a simple xml data string",function(done){

        var init_called = false;
        var finish_called = false;
        var parser = new Xml2Json({

            parser: {
                'person': {
                    init: function(name,attrs) {
                        name.should.equal("person");
                        attrs.should.have.property("name");
                        attrs['name'].should.equal("John");
                        init_called = true;

                        this.parent.root.obj = {};
                        this.obj =  this.parent.root.obj;
                        this.obj['name'] = attrs['name'];
                    },
                    finish: function(name) {

                        this.obj.should.eql({name: 'John',address: 'Paris' });
                        finish_called = true;
                    },
                    parser: {
                        'address': {
                            finish: function(){
                                this.parent.obj['address'] = this.text;
                            }
                        }
                    }
                }
            }
        });


        parser.parseString(
            "<employees>" +
            "   <person name='John'>" +
            "     <address>Paris</address>" +
            "   </person>" +
            "</employees>",function() {
                init_called.should.equal(true);
                finish_called.should.equal(true);

                parser.obj.should.eql({name: 'John',address: 'Paris'});
                done();
            });

    });
});