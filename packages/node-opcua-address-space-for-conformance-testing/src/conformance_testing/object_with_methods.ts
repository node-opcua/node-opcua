/**
 * Object with methods for conformance testing (MethodNoArgs, MethodIO, MethodI, MethodO).
 */
import type { Namespace, UAObject } from "node-opcua-address-space";
import { assert } from "node-opcua-assert";
import { makeNodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import { DataType } from "node-opcua-variant";

export function addObjectWithMethod(namespace: Namespace, parentFolder: UAObject) {
    const myObject = namespace.addObject({
        nodeId: "s=ObjectWithMethods",
        organizedBy: parentFolder,
        browseName: "ObjectWithMethods"
    });

    // MethodNoArgs
    const methodNoArgs = namespace.addMethod(myObject, {
        browseName: "MethodNoArgs",
        nodeId: "s=MethodNoArgs"
    });
    assert(
        makeNodeId("MethodNoArgs", namespace.index)
            .toString()
            .match(/s=MethodNoArgs/)
    );
    assert(methodNoArgs.nodeId.toString().match(/s=MethodNoArgs/));

    methodNoArgs.bindMethod((_inputArguments, _context, callback) => {
        callback(null, { statusCode: StatusCodes.Good, outputArguments: [] });
    });

    // MethodIO (input + output)
    const methodIO = namespace.addMethod(myObject, {
        browseName: "MethodIO",
        nodeId: makeNodeId("MethodIO", namespace.index),
        inputArguments: [
            {
                name: "ShutterLag",
                description: { text: "specifies the number of seconds to wait before the picture is taken " },
                dataType: DataType.UInt32
            }
        ],
        outputArguments: [
            {
                name: "Result",
                description: { text: "the result" },
                dataType: "Int32"
            }
        ]
    });
    methodIO.bindMethod((_inputArguments, _context, callback) => {
        callback(null, {
            statusCode: StatusCodes.Good,
            outputArguments: [{ dataType: DataType.Int32, value: 42 }]
        });
    });

    // MethodI (input only)
    const methodI = namespace.addMethod(myObject, {
        browseName: "MethodI",
        nodeId: "s=MethodI",
        inputArguments: [
            {
                name: "ShutterLag",
                description: { text: "specifies the number of seconds to wait before the picture is taken " },
                dataType: DataType.UInt32
            }
        ]
    });
    methodI.bindMethod((_inputArguments, _context, callback) => {
        callback(null, { statusCode: StatusCodes.Good, outputArguments: [] });
    });

    // MethodO (output only)
    const methodO = namespace.addMethod(myObject, {
        browseName: "MethodO",
        nodeId: "s=MethodO",
        outputArguments: [
            {
                name: "Result",
                description: { text: "the result" },
                dataType: "Int32"
            }
        ]
    });
    methodO.bindMethod((_inputArguments, _context, callback) => {
        callback(null, {
            statusCode: StatusCodes.Good,
            outputArguments: [{ dataType: DataType.Int32, value: 42 }]
        });
    });
}
