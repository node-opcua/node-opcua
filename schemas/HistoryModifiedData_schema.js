var HistoryModifiedData_Schema = {
    name: "HistoryModifiedData",
    fields: [
        { name: "dataValues",        isArray: true, fieldType:"DataValue" , documentation: "An array of values of history data for the Node. The size of the array depends on the requested data parameters." },
        { name: "modificationInfos", isArray: true, fieldType:"ModificationInfo" }
    ]
};
exports.HistoryModifiedData_Schema = HistoryModifiedData_Schema;