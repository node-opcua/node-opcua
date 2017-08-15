var HistoryUpdateType = require("./HistoryUpdateType_enum").HistoryUpdateType;

var ModificationInfo_Schema = {
    name: "ModificationInfo",
    fields: [
        { name: "username" , fieldType: "String" , documentation: "The name of the user that made the modification. Support for this field is optional. A null shall be returned if it is not defined." },
        { name: "modificationTime" , fieldType: "UtcTime" , documentation: " The time the modification was made. Support for this field is optional. A null shall be returned if it is not defined." },
        { name: "updateType" , fieldType: "HistoryUpdateType" , documentation: " The modification type for the item." }
    ]
};
exports.ModificationInfo_Schema = ModificationInfo_Schema;

