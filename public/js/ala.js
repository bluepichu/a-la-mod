var ala = ala || {};
ala.chats = {};
ala.spark = new Spark(Handlebars);
ala.messageCounter = 0;

if(!$.cookie("mods-enc")){
	$.cookie("mods-enc", "");
}

if(!$.cookie("mods-dec")){
	$.cookie("mods-dec", "");
}

moment.locale("en", {
	calendar: {
		lastDay : "[Yesterday at] LT",
		sameDay : function(){
			if(moment().diff(this, "minute") == 0){
				return "[Just now]";
			}
			if(moment().diff(this, "hour") == 0){
				return moment().diff(this, "minute") + " [minutes ago]";
			}
			return "LT";
		},
		nextDay : "[Tomorrow at] LT",
		lastWeek : "[Last] dddd [at] LT",
		nextWeek : "dddd [at] LT",
		sameElse : function(){
			if(moment(this).startOf("year").isSame(moment().startOf("year"))){
				return "MMMM D [at] LT";
			} else {
				return "MMMM D, YYYY [at] LT";
			}
		}
	}
});

var sendToServer = function(subId, add) {
	var xhr = new XMLHttpRequest()
	xhr.open("POST","/user/notifs/register")
	xhr.setRequestHeader("Content-Type","application/json")
	xhr.send(JSON.stringify({
		subscriptionId: subId,
		email: ala.user.email,
		auth: $.cookie("authToken"),
		shouldAdd: add
	}))
}

$(document).ready(function(){
	
});

Handlebars.registerHelper("gravatar", function(email, size){
	return new Handlebars.SafeString("<img class='grav grav-" + size + "' src='https://www.gravatar.com/avatar/" + (email && typeof(email) == "string" ? md5(email.trim().toLowerCase()) : "") + "?s=" + size + "&d=identicon' />");
});

Handlebars.registerHelper("date", function(date, aux) {
	return moment.unix(date).calendar();
});

ala.spark.set("seconds", 0);
setInterval(function() {
	ala.spark.set("seconds", ala.spark.get("seconds") + 1)
}, 1000);