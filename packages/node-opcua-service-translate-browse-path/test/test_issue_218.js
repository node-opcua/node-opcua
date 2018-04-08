"use strict";
const should = require("should");
const tbp_service = require("..");
const makeBrowsePath = tbp_service.makeBrowsePath;
const BrowsePath = tbp_service.BrowsePath;

describe("#makeBrowsePath", function () {

    it("should parse name containing spaces and ( or )", function () {

        const path = makeBrowsePath("RootFolder", "/Objects/2:MatrikonOPC Simulation Server (DA)");

        const expected = new BrowsePath({
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
