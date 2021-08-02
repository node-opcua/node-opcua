

import {KeyValuePair } from "node-opcua-types";
import { DataType, Variant } from "node-opcua-variant";

describe("bug KeyValuePair", ()=>{

    it("KVP1: should create a KeyValuePair Variant", ()=>{
    
        const v = new Variant({
            dataType: DataType.ExtensionObject,
            value: new KeyValuePair({ key: "A", value: { dataType: DataType.String, value: "B" } })
        });
    });

});

