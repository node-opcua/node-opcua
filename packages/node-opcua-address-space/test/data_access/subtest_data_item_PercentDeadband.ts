"use strict";
import * as should from "should";

import { standardUnits } from "node-opcua-data-access";
import { DataValue } from "node-opcua-data-value";
import { StatusCodes } from "node-opcua-status-code";
import { Variant } from "node-opcua-variant";
import { DataType } from "node-opcua-variant";

import { AddressSpace, Namespace, SessionContext } from "../..";

export function subtest_data_item_PercentDeadband(maintest: any): void {
    describe("PercentDeadband", () => {
        let addressSpace: AddressSpace;
        let namespace: Namespace;
        before(() => {
            addressSpace = maintest.addressSpace;
            namespace = addressSpace.getOwnNamespace();
            should(addressSpace).be.instanceof(AddressSpace);
        });

        it("should provide a mechanism to operate PercentDeadband ", async () => {
            const objectsFolder = addressSpace.findNode("ObjectsFolder")!;

            const analogItem = namespace.addAnalogDataItem({
                browseName: "TemperatureSensor",
                dataType: "Double",
                definition: "(tempA -25) + tempB",
                engineeringUnits: standardUnits.degree_celsius,
                engineeringUnitsRange: { low: -2000, high: 2000 },
                instrumentRange: { low: -100, high: 200 },
                organizedBy: objectsFolder,
                value: new Variant({ dataType: DataType.Double, value: 10.0 }),
                valuePrecision: 0.5
            });

            const dataValue = new DataValue({ value: new Variant({ dataType: DataType.Double, value: -1000.0 }) });

            const statusCode = await analogItem.writeValue(SessionContext.defaultContext, dataValue);
            statusCode.should.eql(StatusCodes.BadOutOfRange);
        });
    });
}
