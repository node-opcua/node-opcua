"use strict";
var Benchmarker = require("node-opcua-benchmarker").Benchmarker;
var should = require("should");

var DataType = require("..").DataType;
var Variant = require("..").Variant;

var Variant1 = require("./data_factory_code_generator/_auto_generated_Variant_Gen1").Variant;
var Variant2 = require("./data_factory_code_generator/_auto_generated_Variant_Gen2").Variant;
var Variant3 = require("./data_factory_code_generator/_auto_generated_Variant_Gen3").Variant;

describe("Benchmarking Factory Implementation", function (done) {


    function test_variant(VariantX) {

        var variant = new VariantX({
            dataType: DataType.Double,
            value: 24
        });
        variant.dataType.should.eql(DataType.Double);

        if (variant.setDataType) {
           variant.setDataType(DataType.Variant);
        } else {
           variant.dataType = DataType.Variant.value;
        }
        variant.dataType.should.eql(DataType.Variant);

        should(function () {
            if (variant.setDataType) {
               // new version uses the set<EnumType> helper function
               variant.setDataType(34);
           } else {
              variant.dataType = 34;
           }
        }).throw();

        var variant2 = new VariantX(variant);

        (variant.hasOwnProperty("dataType") ||
        VariantX.prototype.hasOwnProperty("dataType")).should.eql(true);

        var variant3 = new VariantX(variant);

        variant3.dataType.should.eql(variant.dataType);
        variant3.arrayType.should.eql(variant.arrayType);
        variant3.value.should.eql(variant.value);

    }

    it("Variant1 should work as expected", function (done) {
        test_variant(Variant1);
        done();
    });
    it("Variant2 should work as expected", function (done) {
        test_variant(Variant2);
        done();
    });
    it("Variant3 should work as expected", function (done) {
        test_variant(Variant3);
        done();
    });
    it("Variant should work as expected", function (done) {
        test_variant(Variant);
        done();
    });

    this.timeout(200000);
    function perform_benchmark(params, checks, done) {

        var bench = new Benchmarker();


        function test_iteration(VARIANT) {
            var variant = new VARIANT({
                dataType: DataType.Double,
                value: 24
            });
        }

        bench.add("Variant1", function () {
            test_iteration(Variant1);
        })
            .add("Variant2", function () {
                test_iteration(Variant2);
            })
            .add("Variant3", function () {
                test_iteration(Variant3);
            })
            .add("Variant", function () {
                test_iteration(Variant);
            })
            .on("cycle", function (message) {
                console.log(message);
            })
            .on("complete", function () {

                console.log(" Fastest is " + this.fastest.name);
                console.log(" Speed Up : x", this.speedUp);
                ["Variant3", "Variant"].indexOf(this.fastest.name).should.not.eql(-1);
                done();
            })
            .run();

    }

    it("should", function (done) {
        perform_benchmark(null, null, done);
    });

});
