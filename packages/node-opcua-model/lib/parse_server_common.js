"use strict";
const {
    populateDataTypeManager,
    ExtraDataTypeManager
} = require("node-opcua-client-dynamic-extension-object");

const chalk = require("chalk");
const doDebug = false;

async function parse_opcua_common(session) {
    const dataTypeManager = new ExtraDataTypeManager();
    await populateDataTypeManager(session, dataTypeManager);
}

exports.parse_opcua_common = parse_opcua_common;
