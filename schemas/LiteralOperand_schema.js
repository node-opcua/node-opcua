var LiteralOperand_Schema = {
    name:"LiteralOperand",
    baseType:"FilterOperand",
    fields: [
        // TODO :fix me :ich how do I know which type to use here ?
        { name: "value", fieldType:"BaseDataType", documentation: "A literal value."}
    ]
};
exports.LiteralOperand_Schema  = LiteralOperand_Schema;
