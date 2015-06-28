ala.chats = {};
ala.spark = new Spark(Handlebars);
ala.messageCounter = [0, 0];

if(!("recipes" in localStorage)){
	localStorage.recipes = JSON.stringify(
		{
			selected: "Empty",
			all: {
				"Empty": {
					mods: {},
					description: "An empty recipe to get you started."
				}
			}
		});
}

ala.recipes = JSON.parse(localStorage.recipes);
ala.selected = ala.recipes.selected;


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
	for (var m in ala.recipes.all[ala.selected].mods) {
		ala.mods.initializeEncoder(m)
	}

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
	$("ala-notif-container").append(Handlebars.templates.bell())
	ala.pushInst = new pushManager()
	ala.pushInst.onLoad = function(err, sub) {
		console.log("Load>>",arguments)
		if (ala.pushInst.available) {
			ala.spark.set("available",true)
		} else {
			ala.spark.set("available",false)
			return
		}
		if (ala.pushInst.enabled) {
			ala.spark.set("enabled",true)
		} else {
			ala.spark.set("enabled",false)
		}
		$("#notification").click(notifFunc)
	}
	ala.pushInst.onSubscribe = function(err, sub) {
		console.log("Sub>>",arguments, ala.pushInst)
		ala.spark.set("enabled", ala.pushInst.enabled)
		sendToServer(ala.pushInst.subscriptionId, true)
		$("#notification").click(notifFunc)
	}
	ala.pushInst.onUnsubscribe = function() {
		console.log("Unsub>>",arguments,ala.pushInst)
		console.log(ala.pushInst)
		ala.spark.set("enabled", ala.pushInst.enabled)
		sendToServer(ala.pushInst.subscriptionId, false)
		$("#notification").click(notifFunc)
	}
	notifFunc = function() {
		console.log("boo")
		if (!ala.spark.get("available")) {
			return
		}
		if (ala.spark.get("enabled")) {
			ala.pushInst.unsubscribe()
		} else {
			ala.pushInst.subscribe()
		}
	}
	$("#notification").click(notifFunc)

	var cont = $("ala-mod-list");
	ala.iframes = []
	for (var m in ala.recipes.all[ala.selected].mods) {
		var mod = ala.recipes.all[ala.selected].mods[m]
		if (mod.ui) {
			var insert = $(Handlebars.templates["mod-card"]({
				title: mod.title || m,
				mod: m
			}))
			cont.append(insert)
			ala.iframes.push(insert)
			insert.ready((function(m) {return function() {
				ala.mods.registerUI(m, insert.find("iframe")[0].contentWindow)
			}})(m))
		}
	}

	autosize($("ala-input-card textarea"));

	$("ala-input-card textarea").keydown(function(e){
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
		if($("ala-input-card textarea").val().match(/^\s*$/)){
			$("ala-input-card textarea").val("");
		} else {
			ala.submit();
		}
	});

	ala.socket = io()

	ala.socket.on("connect", function() {
		console.log("Socket connected")
		ala.socket.emit("hidden", false);
		$(document).on("visibilitychange", function() {
			ala.socket.emit("hidden",document.hidden)
		})

		if($.cookie("email") && $.cookie("authToken")){
			$("ala-entrance").css("transition", "none");
			ala.socket.emit("login", $.cookie("email"), $.cookie("authToken"));
		}
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
		ala.chats[dat._id] = {
			users: dat.users,
			unread: 0,
			listing: $(Handlebars.templates["chat-card"]({
				id: dat._id,
				title: dat.title,
				members: dat.users,
				mostRecent: undefined
			}))
		}
		ala.chatCount++;
		ala.chats[dat._id].listing.click(function(){
			if(!$(this).hasClass("active") && !ala.lockOpenChat){
				ala.openChat($(this).attr("chat-id"));
			}
		});
		ala.chats[dat._id].listing.css({
			position: "absolute",
			right: "100%",
			top: "100%"
		});
		$("main").append(ala.chats[dat._id].listing);
		$("ala-chat-card").capturePosition();
		ala.chats[dat._id].listing.css({
			position: "",
			right: "",
			top: ""
		});
		$("ala-chat-list").prepend(ala.chats[dat._id].listing.detach());
		$("ala-chat-card").animateReposition();
	});

	ala.socket.on("message", function(chatId, message){
		var unprocessed = "";
		for(var i = 0; i < message.message.length; i++){
			var val = message.message[i];
			while(val.fallback){
				val = val.fallback;
			}
			unprocessed += val;
		}
		ala.chats[chatId].listing.find("ala-last-message .message").removeClass("hint").text(unprocessed);
		// TODO: user list order

		if(ala.currentChat == chatId){
			ala.appendMessage(message);
			ala.socket.emit("up to date", chatId);
		} else {
			ala.chats[chatId].unread++;
			$("ala-chat-list").prepend(ala.chats[chatId].listing);
		}
	});

	ala.submit = function(){
		ala.mods.encode($("ala-input-card textarea").val(), ala.recipes.all[ala.selected].mods, function(data){
			ala.socket.emit("message", ala.currentChat, data);
		});
		$("ala-input-card textarea").val("");
		return false;
	}

	ala.openChat = function(chatId){
		if(!chatId){
			ala.currentChat = null;
			$("ala-chat-card").capturePosition();
			$("ala-messages-card").css("margin-top", $("ala-active-chat ala-chat-card").outerHeight());
			$("main").attr("state", "list");
			$("#back").addClass("gone");
			$("ala-chat-list").prepend($("ala-active-chat ala-chat-card").detach());
			$("ala-chat-card:not(:first-child)").css("visibility", "hidden");
			$("ala-chat-card:first-child").animateReposition();
			setTimeout(function(){
				$("ala-chat-card:not(:first-child)").css("visibility", "visible").animateReposition();
			}, 400);
			return;
		}
		var xhr = new XMLHttpRequest();
		xhr.open("POST", "/chat/history", true);
		ala.lockOpenChat = true;
		xhr.onload = function(){
			if(this.status == 200){
				var data = JSON.parse(this.responseText);
				$("ala-messages-list").empty();
				ala.chats[chatId].unread = 0;
				ala.nextPage = 1;
				ala.loadMorePages = true;

				for(var i = 0; i < data.messages.length; i++){
					ala.appendMessage(data.messages[i]);
				}
			} else {
				ala.snack(this.responseText);
			}
		}
		xhr.setRequestHeader("Content-Type", "application/json");
		xhr.send(JSON.stringify({
			email: $.cookie("email"),
			authToken: $.cookie("authToken"),
			chatId: chatId
		}));
		ala.currentChat = chatId;
		ala.chatGroupCounter = [0, 0];
		ala.spark.reset();
		$("ala-chat-card").capturePosition();
		$("main").attr("state", "chat-active");
		$("#back").removeClass("gone");
		$("ala-messages-card").css("margin-top", 0);
		$("ala-active-chat").prepend($("ala-chat-card[chat-id='" + chatId + "']").detach());
		$("ala-chat-card").animateReposition();
	}

	ala.appendMessage = function(data){
		ala.messageCounter[0]++;

		if(data.message.length == 1 && data.message[0].stream){
			ala.mods.decode(data.message, ala.recipes.all[ala.selected].mods, function(){});
		} else {
			var atBottom = ($("ala-messages-list").scrollTop() >= $("ala-messages-list")[0].scrollHeight - $("ala-messages-list").height());
			if($("ala-messages-list").children().last().attr("sender") != data.sender._id){
				ala.chatGroupCounter[0]++;
				$("ala-messages-list").append(Handlebars.templates["chat-group"]({
					sender: data.sender,
					you: data.sender._id == ala.user._id,
					timestamp: "|date-f" + ala.chatGroupCounter[0],
				}));
			}

			var newMessage = $(Handlebars.templates["chat-message"]({
				sender: data.sender
			}));

			$("ala-messages-list").children().last().append(newMessage);
			if(atBottom){
				$("ala-messages-list").scrollTop($("ala-messages-list")[0].scrollHeight);
			}
			newMessage.attr("message-id", "f" + ala.messageCounter[0]);
			ala.spark.set("date-f" + ala.chatGroupCounter[0], data.timestamp);

			ala.mods.decode(data.message, ala.recipes.all[ala.selected].mods, function(id, sender){
				return function(data){
					for(var i = 0; i < data.length; i++){
						if(data[i].fallback !== undefined){
							data[i] = data[i].fallback;
						}
						if(data[i].type == "SafeString"){
							data[i] = {content: new Handlebars.SafeString(data[i].content), decoder: data[i].decoder};
						}
					}
					var message = $(Handlebars.templates["chat-message"]({
						message: data,
						sender: sender
					}));
					var atBottom = ($("ala-messages-list").scrollTop() >= $("ala-messages-list")[0].scrollHeight - $("ala-messages-list").height());
					$("[message-id=" + id + "]").replaceWith(message);
					if(atBottom){
						$("ala-messages-list").scrollTop($("ala-messages-list")[0].scrollHeight);
					}
				}
			}("f" + ala.messageCounter[0], data.sender));
		}
	}

	ala.prependMessage = function(data){
		ala.messageCounter[1]++;

		if($("ala-messages-list").children().first().attr("sender") != data.sender._id){
			ala.chatGroupCounter[1]++;
			$("ala-messages-list").prepend(Handlebars.templates["chat-group"]({
				sender: data.sender,
				you: data.sender._id == ala.user._id,
				timestamp: "|date-b" + ala.chatGroupCounter[1],
			}));
		}

		var newMessage = $(Handlebars.templates["chat-message"]({
			sender: data.sender
		}));
		$("ala-message-list").children().first().prepend(newMessage);
		newMessage.attr("message-id", "b" + ala.messageCounter[1]);
		ala.spark.set("date-b" + ala.chatGroupCounter[1], data.timestamp);

		ala.mods.decode(data.message, decodeOrder, function(id, sender){
			return function(data){
				for(var i = 0; i < data.length; i++){
					if(data[i].fallback !== undefined){
						data[i] = data[i].fallback;
					}
					if(data[i].type == "SafeString"){
						data[i] = {content: new Handlebars.SafeString(data[i].content), decoder: data[i].decoder};
					}
				}
				var message = $(Handlebars.templates["chat-message"]({
					message: data,
					sender: sender
				}));
				$("[message-id=" + id + "]").replaceWith(message);
			}
		}("b" + ala.messageCounter[1], data.sender));
	}

	ala.loadPreviousPage = function(){
		if(ala.loadingPage || !ala.loadMorePages){
			return;
		}
		var xhr = new XMLHttpRequest();
		xhr.open("POST", "/chat/history", true);
		xhr.onload = function(){
			if(this.status == 200){
				var data = JSON.parse(this.responseText);
				var messages = data.messages;

				var lastMessage = $("ala-message-list").children("ala-message-group").first().children("ala-chat-message").first();

				for(var i = messages.length-1; i >= 0; i--){
					ala.prependMessage(messages[i]);
				}

				if(lastMessage.position()){
					$("ala-message-list-viewport").scrollTop(lastMessage.position().top);
				}

				if(messages.length == 0){
					ala.loadMorePages = false;
					$("ala-message-list").addClass("no-load");
				}

				ala.nextPage++;
			} else {
				ala.snack(this.responseText);
			}
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
			var chats = JSON.parse(this.responseText);

			chats.sort(function(a, b){
				return (b.messages[0] ? b.messages[0].timestamp : b.creationTime) - (a.messages[0] ? a.messages[0].timestamp : b.creationTime);
			});

			ala.chatCount = 0;

			for(var i = 0; i < chats.length; i++){
				if(chats[i].messages.length > 0){
					var unprocessed = "";
					for(var j = 0; j < chats[i].messages[0].message.length; j++){
						var val = chats[i].messages[0].message[j];
						while(val.fallback){
							val = val.fallback;
						}
						unprocessed += val;
					}
					chats[i].messages[0].message = unprocessed;
				}
				ala.chats[chats[i]._id] = {
					users: chats[i].users,
					unread: chats[i].messageCount - chats[i].lastRead[ala.user._id],
					listing: $(Handlebars.templates["chat-card"]({
						id: chats[i]._id,
						title: chats[i].title,
						members: chats[i].users,
						lastMessage: chats[i].messages[0],
						starred: chats[i].starred
					}))
				};
				$("ala-chat-list").append(ala.chats[chats[i]._id].listing);
				ala.chatCount++;
			}
		};
		xhr.setRequestHeader("Content-Type", "application/json");
		xhr.send(JSON.stringify({
			email: $.cookie("email"),
			authToken: $.cookie("authToken")
		}));
	}

	ala.lightbox = function(formId, doNotClear){
		if(formId){
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
		$("form#" + formId + " ala-user-list").empty().append(Handlebars.templates["user-chip"](ala.user));
	}

	ala.setLoading = function(loading){
		if(loading){
			$("ala-input-blocker").addClass("active");
			$(".spinner-target").addClass("loading");
		} else {
			$("ala-input-blocker").removeClass("active");
			$(".spinner-target").removeClass("loading");
		}
	}

	ala.onLogin = function(err){
		if(err){
			ala.snack(err);
			$("ala-entrance").css("transition", "");
			$.cookie("authToken", "");
		} else {
			$("ala-entrance").addClass("authorized");
			ala.clearSnack();
			ala.socket.emit("login", $.cookie("email"), $.cookie("authToken"));
			setTimeout(function(){
				ala.snack("Welcome back!");
			}, 1000);
		}
	}

	ala.addModCard = function(mod){
		// TODO
		var newCard = $(Handlebars.templates["mod-card"]({
			title: mod.owner + "/" + mod.name
		}));
		$("ala-mod-list").append(newCard);
		newCard.css({
			transition: "none",
			position: "relative",
			left: "50%"
		});
		newCard.redraw();
		newCard.css({
			transition: "",
			left: 0
		});
	}

	$("ala-chat-list").on("click", "ala-chat-card", function(e){
		ala.openChat($(this).attr("chat-id"));
	});

	$("#back").click(function(){
		ala.openChat();
	});

	$("ala-chat-list").on("click", "#star", function(e){
		$("ala-chat-card").capturePosition();
		var card = $(this).parent().parent().parent();
		if(card.attr("starred") !== undefined){
			card.removeAttr("starred");
		} else {
			card.attr("starred", "");
		}
		ala.socket.emit("set star", card.attr("chat-id"), card.attr("starred") == "");
		$("ala-chat-card").animateReposition();
		e.preventDefault();
		e.stopPropagation();
		return false;
	});

	$("ala-mod-list").on("click", "ala-mod-card #expand", function(e){
		$("ala-fullscreen-mod").append("<div></div>");
		setTimeout(function(card){
			return function(){
				$("ala-fullscreen-mod").empty();
				$(card).capturePosition();
				$("ala-fullscreen-mod").append(card.detach());
				$(card).animateReposition();
				e.preventDefault();
				e.stopPropagation();
				return false;
			}
		}($(this).parent().parent().parent()), 800);
	});

	$("ala-fullscreen-mod").on("click", "ala-mod-card #collapse", function(e){
		var card = $(this).parent().parent().parent();
		card.animateRepositionReverse();
		setTimeout(function(card){
			return function(){
				$("ala-mod-list").prepend(card.detach());
				card.css({
					left: 0,
					top: 0
				});
			}
		}(card), 400);
	});
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
