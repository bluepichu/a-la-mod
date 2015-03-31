//A lightweight Handlebars live rendering system similar to ember and blaze
//Written 2015 by zwade

Spark = function(hb) {
	this._hb = hb;
	this._kvp = {};
	this._upd = {};
	var that = this;

	hb.registerHelper("spark", function() {
		var hbstr = "{{";
		var params = [];
		for (var i = 0; i < arguments.length - 1; i++) {
			if (typeof arguments[i] == "string") {
				var cmd = arguments[i].charAt(0);
				if (cmd == ">") {
					hbstr += arguments[i].slice(1) + " ";
					continue;
				} 
				if (cmd == "|") {
					var param = arguments[i].slice(1);
					if (!that._upd[param]) {
						that._upd[param] = []
					}
					params.push(param);
					hbstr += param + " ";
					continue;
				}
				hbstr += "\"" + arguments[i] + "\" "
			}
			hbstr += arguments[i] + " "
		}
		hbstr = hbstr.slice(0,-1)+"}}"
		var id = Math.floor(Math.random()*100000000).toString()
		var upFunc = function (str, params, spark) {  //uptown func you up
			return function() {
				var cont = {}
				for (var p = 0; p < params.length; p++) {
					cont[params[p]] = spark._kvp[params[p]];
				}
				return spark._hb.compile(str)(cont);
			}
		}(hbstr, params, that)
		for (var p = 0; p < params.length; p++) {
			that._upd[params[p]].push({funct: upFunc, id: id})
		}
		return new that._hb.SafeString("<spark-block id='"+id+"'>"+upFunc()+"</spark-block>");

	})
}

Spark.prototype.set = function(key,value) {
	this._kvp[key] = value;
	if (this._upd[key]) {
		for (var f = 0; f < this._upd[key].length; f++) {
			document.getElementById(this._upd[key][f].id).innerHTML = this._upd[key][f].funct();
		}
	}
}

Spark.prototype.get = function(key) {
	return this._kvp[key];
}