// OPC Unified Architecture, Part 6  page 36
var ChannelSecurityToken_Schema = {
    name: "ChannelSecurityToken",
    fields: [
        { name: "secureChannelId", fieldType: "UInt32"                     },
        { name: "tokenId", fieldType: "UInt32"                     },
        { name: "createdAt", fieldType: "UtcTime", defaultValue: function () {
            return new Date();
        }  },
        { name: "revisedLifeTime", fieldType: "UInt32", defaultValue: 30000   }
    ]
};
exports.ChannelSecurityToken_Schema =ChannelSecurityToken_Schema;
