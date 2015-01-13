var LiteralOperand_Schema = {
    name:"LiteralOperand",
    baseType:"FilterOperand",
    fields: [
        // TODO :fix me :ich how do I know which type to use here ?
        { name: "value", fieldType:"Any", documentation: "A literal value." ,defaultValue: 0}
    ],
    decode : function(self,stream) {

        self.value = 0;
    },
    decode_debug : function(self,stream) {
        self.value = 0;

    },
    encode : function(self,stream) {
        // self.value = 0;
    }
};
exports.LiteralOperand_Schema  = LiteralOperand_Schema;
