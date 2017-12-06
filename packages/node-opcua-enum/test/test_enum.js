"use strict";

var Enum = require("..");
var should = require("should");
var _ = require("underscore");

describe("Test Enum", function () {

    it("should create flaggable enum from string array", function () {
        var e = new Enum(["e1", "e2", "e3"]);
        e.get("e1").value.should.equal(1);
        e.get("e2").value.should.equal(2);
        e.get("e3").value.should.equal(4);
        e.get("e3 | e1").value.should.equal(5);
        e.get(3).key.should.equal("e1 | e2");
        e.get(3).value.should.equal(3);
        should(e.get(9)).equal(undefined);
        should(e.get(0)).equal(undefined);
    });

    it("should create flaggable enum from flaggable map", function () {
        var e = new Enum({"e1": 1, "e2": 2, "e3": 4});
        e.get("e1").value.should.equal(1);
        e.get("e2").value.should.equal(2);
        e.get("e3").value.should.equal(4);
        e.get("e3 | e1").value.should.equal(5);
        e.get(3).key.should.equal("e1 | e2");
        e.get(3).value.should.equal(3);
        should(e.get(9)).equal(undefined);
        should(e.get(0)).equal(undefined);
    });

    it("should create non-flaggable enum from non-flaggable map", function () {
        var e = new Enum({"e1": 1, "e2": 2, "e3": 3});
        e.get("e1").value.should.equal(1);
        e.get("e2").value.should.equal(2);
        e.get("e3").value.should.equal(3);
        should(e.get(5)).equal(undefined);
        should(e.get("e0")).equal(undefined);
        should(e.get("e3 | e1")).equal(undefined);
        e.get(3).key.should.equal("e3");
        e.get(3).value.should.equal(3);
        e.enums[0].key.should.equal("e1");
    });

    it("should access enum from enum item name", function () {
        var e = new Enum({"e1": 1, "e2": 2, "e3": 4});
        e.e1.value.should.equal(1);
        e.e1.key.should.equal("e1");
        e.e2.value.should.equal(2);
        e.e2.key.should.equal("e2");
        e.e3.value.should.equal(4);
        e.e3.key.should.equal("e3");
    });

    it("EnumItem should function properly", function () {
        var e = new Enum({"e1": 1, "e2": 2, "e3": 4});
        var e1ore2 = e.get("e2 | e1");
        e1ore2.value.should.equal(3);
        e1ore2.is(e.get(3)).should.equal(true);
        e1ore2.is(3).should.equal(true);
        e1ore2.is("e2 | e1").should.equal(true);
        e1ore2.is(e.get(5)).should.equal(false);
        e1ore2.is(5).should.equal(false);
        e1ore2.is("e1 | e3").should.equal(false);
        e1ore2.has("e1").should.equal(true);
        e1ore2.has("e2").should.equal(true);
        e1ore2.has("e3").should.equal(false);
        e1ore2.has(1).should.equal(true);
        e1ore2.has(2).should.equal(true);
        e1ore2.has(4).should.equal(false);
        e1ore2.has(e.e1).should.equal(true);
        e1ore2.has(e.e2).should.equal(true);
        e1ore2.has(e.e3).should.equal(false);
        e1ore2.toString().should.equal("e2 | e1");
        e1ore2.valueOf().should.equal(3);
        e1ore2.toJSON().should.equal("e2 | e1");
        e.e1.toString().should.equal("e1");
        e.e1.valueOf().should.equal(1);
        e.e1.toJSON().should.equal("e1");
    });

});

var Benchmarker = require("node-opcua-benchmarker").Benchmarker;


var EnumSlow = require("enum");
var EnumFast = require("..");

describe("Benchmarking Enums", function () {


    function perform_benchmark(params, checks, done) {

        var bench = new Benchmarker();

        var keys = _.isArray(params) ? params : Object.keys(params);

        function test_iteration(en) {

            var e1 = en.SOMEDATA;
            should.not.exist(e1);
            var e2 = en.get("OTHERDATA");
            should.not.exist(e2);

            en[keys[0]].value.should.eql(en.get(keys[0]).value);

            var item = en[keys[0]];
            en.get(item).value.should.eql(item.value);


            checks.forEach(function (p) {
                p.value.should.eql(en.get(p.key).value);
                p.value.should.eql(en.get(p.value).value);
            });
        }

        bench.add("slowEnum", function () {

            var en = new EnumSlow(params);
            test_iteration(en);

        })
        .add("fastEnum", function () {

            var en = new EnumFast(params);
            test_iteration(en);
        })
        .on("cycle", function (message) {
            console.log(message);
        })
        .on("complete", function () {

            console.log(" Fastest is " + this.fastest.name);
            console.log(" Speed Up : x", this.speedUp);
            if (this.speedUp > 1.5) {
                // if the speedUp is greater than 1 ,
                // our implementation should win
                this.fastest.name.should.eql("fastEnum");
            }
            done();
        })
        .run();

    }


    it("should verify that our enums are faster than  Enum 2.1.0 (flaggable enum)", function (done) {

        var AccessLevelFlag = {
            CurrentRead: 0x01,
            CurrentWrite: 0x02,
            HistoryRead: 0x04,
            HistoryWrite: 0x08,
            SemanticChange: 0x10
        };

        var checks = [
            {key: "CurrentWrite | HistoryWrite", value: 0x0A},
            {key: "HistoryWrite | CurrentWrite", value: 0x0A},
            {key: "CurrentWrite", value: 0x02},
            {key: "CurrentWrite | CurrentWrite", value: 0x02},
            {key: "CurrentRead | CurrentWrite | HistoryRead | HistoryWrite | SemanticChange", value: 0x1F},
            {key: "CurrentRead", value: 0x01},
            {key: "HistoryRead", value: 0x04},
            {key: "HistoryWrite", value: 0x08}
        ];
        perform_benchmark(AccessLevelFlag, checks, done);
    });

    it("should verify that our enums are faster than Enum 2.1.0 ( simple enum )", function (done) {
        var ApplicationType = {
            SERVER: 0, // The application is a Server
            CLIENT: 1, // The application is a Client
            CLIENTANDSERVER: 2, // The application is a Client and a Server
            DISCOVERYSERVER: 3  // The application is a DiscoveryServer
        };
        var checks = [
            {key: "SERVER", value: 0},
            {key: "CLIENT", value: 1},
            {key: "CLIENTANDSERVER", value: 2},
            {key: "DISCOVERYSERVER", value: 3}
        ];
        perform_benchmark(ApplicationType, checks, done);

    });


});
