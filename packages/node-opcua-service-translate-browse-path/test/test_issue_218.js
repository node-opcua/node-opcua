"use strict";
var should = require("should");
var tbp_service = require("..");
var makeBrowsePath = tbp_service.makeBrowsePath;
var BrowsePath = tbp_service.BrowsePath;

describe("#makeBrowsePath", function () {

    it("should parse name containing spaces and ( or )", function () {

        var path = makeBrowsePath("RootFolder", "/Objects/2:MatrikonOPC Simulation Server (DA)");

        var expected = new BrowsePath({
            startingNode: "ns=0;i=84",
            relativePath: {
                elements: [
                    {
                        referenceTypeId: "ns=0;i=33",
                        isInverse: false,
                        includeSubtypes: true,
                        targetName: {
                            name: "Objects"
                        }
                    },
                    {
                        referenceTypeId: "ns=0;i=33",
                        isInverse: false,
                        includeSubtypes: true,
                        targetName: {
                            namespaceIndex: 2,
                            name: "MatrikonOPC Simulation Server (DA)"
                        }
                    }
                ]
            }
        });
        //xx console.log(path.toString());
        path.should.eql(expected);

    });
});
