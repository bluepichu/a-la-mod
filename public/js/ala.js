ala.chats = {};
ala.spark = new Spark(Handlebars);
ala.messageCounter = 0;

if(!("recipes" in localStorage)){
	localStorage.recipes = JSON.stringify({
		encoding: {
			selected: {
				name: "Empty",
				description: "An empty recipe to get you started.",
				mods: []
			},
			list: []
		},
		decoding: {
			selected: {
				name: "Empty",
				description: "An empty recipe to get you started.",
				mods: []
			},
			list: []
		}
	});
}

ala.recipes = JSON.parse(localStorage.recipes);

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
	$("form:not(.disable-enter-submission) input[type=text]:not(.disable-enter-submission), form:not(.disable-enter-submission) input[type=password]:not(.disable-enter-submission)").keydown(function(e){
		if(e.keyCode == 13){
			$(this).parent().submit();
			e.stopPropagation();
			return false;
		}
	});

	ala.clearSnack = function(){
		if(ala.currentSnackTimeout){
			clearTimeout(ala.currentSnackTimeout);
		}
		$("ala-snack-bar").removeClass("active gone");
	}

	ala.snack = function(text){
		ala.clearSnack();
		ala.currentSnackTimeout = setTimeout(function(){
			$("ala-snack-bar").html(text);
			$("ala-snack-bar").addClass("active");
			ala.currentSnackTimeout = setTimeout(function(){
				$("ala-snack-bar").addClass("gone");
			}, 5000);
		}, 10);
	}

	autosize($("ala-input-card textarea")); 
	$("#ala-input-card textarea").keydown(function(e){
		if(e.keyCode == 13 && !e.shiftKey){
			if($(this).val().match(/^\s*$/)){
				$(this).val("");
			} else {
				ala.submit();
			}
			e.stopPropagation();
			e.preventDefault();
			return false;
		}
	});

	$("ala-input-card #send").click(function(){
		ala.submit();
	});

	ala.socket = io()

	ala.socket.on("connect", function() {
		console.log("Socket connected")
		ala.socket.on("hidden",false)
	})

	ala.socket.on("login", function(err, dat){
		if(err){
			ala.snack(err);
		} else {
			ala.user = dat;
			ala.loadChats();
			ala.onLogin(err);
		}
	});

	ala.socket.on("new chat", function(dat){

	});

	ala.submit = function(){
		ala.mods.encode($("ala-input-card textarea").val(), ala.recipes.encoding.selected, function(data){
			ala.socket.emit("message", ala.currentChat, data);
		});
		$("ala-input-card textarea").val("");
		return false;
		return false;
	}

	ala.openChat = function(chatId){
		var xhr = new XMLHttpRequest();
		xhr.open("POST", "/chat/history", true);
		ala.lockOpenChat = true;
		xhr.onload = function(){
			// TODO
		}
		xhr.setRequestHeader("Content-Type", "application/json");
		xhr.send(JSON.stringify({
			email: $.cookie("email"),
			authToken: $.cookie("authToken"),
			chatId: chatId
		}));
		ala.currentChat = chatId;
		ala.chatGroupCounterStart = 0;
		ala.chatGroupCounterEnd = 1e9;
		ala.spark.reset();
	}

	ala.appendMessage = function(data){
		//TODO
	}

	ala.prependMessage = function(data){
		//TODO
	}

	ala.loadPreviousPage = function(){
		if(ala.loadingPage || !ala.loadMorePages){
			return;
		}
		var xhr = new XMLHttpRequest();
		xhr.open("POST", "/chat/history", true);
		xhr.onload = function(){
			// TODO
		}
		xhr.setRequestHeader("Content-Type", "application/json");
		ala.loadingPage = true;
		xhr.send(JSON.stringify({
			email: $.cookie("email"),
			authToken: $.cookie("authToken"),
			chatId: ala.currentChat,
			page: ala.nextPage
		}));
	}

	ala.loadChats = function(){
		var xhr = new XMLHttpRequest();
		xhr.open("POST", "/chats", true);
		xhr.onload = function(){
			// TODO
		};
		xhr.setRequestHeader("Content-Type", "application/json");
		xhr.send(JSON.stringify({
			email: $.cookie("email"),
			authToken: $.cookie("authToken")
		}));
	}

	ala.lightbox = function(formId, doNotClear){
		if(formId != ""){
			if(!doNotClear){
				ala.clearForm(formId);
			}
			$("ala-lightbox-container").addClass("active");
			$("ala-lightbox-container form").addClass("hidden");
			$("ala-lightbox-container form#" + formId).removeClass("hidden");
		} else {
			$("ala-lightbox-container").removeClass("active");
		}
	}
	ala.clearForm = function(formId){
		$("form#" + formId + " input").val("");
	}
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