var AggregateConfiguration_Schema = {
    name: "AggregateConfiguration",
    //xx baseType:"ExtensionObject",
    isAbstract: true,
    fields: [
        { name: "useServerCapabilitiesDefaults", fieldType: "Boolean" },
        { name: "treatUncertainAsBad", fieldType: "Boolean" },
        { name: "percentDataBad", fieldType: "Byte"    },
        { name: "percentDataGood", fieldType: "Byte"    },
        { name: "useSlopedExtrapolation", fieldType: "Boolean" }
    ]
};
exports.AggregateConfiguration_Schema = AggregateConfiguration_Schema;
