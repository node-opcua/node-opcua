

var hashCounter = 1;
function ObjectRegisty() {
    this._cache = {};
}

ObjectRegisty.prototype.register= function(obj) {
    if (!obj._____hash) {
        obj._____hash = hashCounter;
        hashCounter +=1;
        this._cache[obj._____hash] = obj;
    }
};

ObjectRegisty.prototype.unregister= function(obj) {
    delete  this._cache[obj._____hash];
};

ObjectRegisty.prototype.count = function() {
  return Object.keys(this._cache).length;
};
exports.ObjectRegisty = ObjectRegisty;
