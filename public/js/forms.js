$(document).ready(function(){
	$("ala-icon#mods").click(function(){
		ala.lightbox("form-mods");
		$("#form-mods #mods-enc").val(ala.recipes.encoding.selected.mods.join("\n"));
		$("#form-mods #mods-dec").val(ala.recipes.decoding.selected.mods.join("\n"));
		$("#form-mods #mods-ui").val(ala.recipes.ui.mods.join("\n"));
	});

	$("ala-icon#account").click(function(){
		ala.lightbox("form-account-settings");
		$("#form-account-settings #screen-name").val(ala.user.screenName);
		$("#form-account-settings #color-picker").children().removeClass("active");
		$("#color-picker").find("ala-color-swatch[color=" + ala.user.color + "]").addClass("active");
	});

	$("ala-icon#logout").click(function(){
		$.cookie("email", "");
		$.cookie("authToken", "");
		ala.snack("Logged out.  Refreshing...");
		setTimeout(function(){
			location.reload();
		}, 2000);
	});

	$("button#new-chat").click(function(e){
		ala.lightbox("form-new-chat");
		e.preventDefault();
		e.stopPropagation();
		return false;
	});

	$("button#cancel").click(function(e){
		ala.lightbox();
		e.preventDefault();
		e.stopPropagation();
		return false;
	});

	$("button#submit").click(function(e){
		$(this).submit();
		e.preventDefault();
		e.stopPropagation();
		return false;
	});

	$("form:not(.disable-enter-submission) input[type=text]:not(.disable-enter-submission), form:not(.disable-enter-submission) input[type=password]:not(.disable-enter-submission)").keydown(function(e){
		if(e.keyCode == 13){
			$(this).parent().submit();
			e.stopPropagation();
			return false;
		}
	});

	$("ala-color-swatch").click(function(){
		$(this).parent().children().removeClass("active");
		$(this).addClass("active");
	});

	$("form#form-mods").submit(function(e){
		ala.recipes.encoding.selected = {
			title: "TODO",
			description: "TODO",
			mods: $("#mods-enc").val().split(/[,;\s]+/g)
		}

		ala.recipes.decoding.selected = {
			title: "TODO",
			description: "TODO",
			mods: $("#mods-dec").val().split(/[,;\s]+/g)
		}

		if (!ala.recipes.ui) {
			ala.recipes.ui = {}
		}
		ala.recipes.ui.mods = $("#mods-ui").val().split(/[,;\s]+/g)

		localStorage.recipes = JSON.stringify({
			encoding: {
				selected: ala.recipes.encoding.selected
			},
			decoding: {
				selected: ala.recipes.decoding.selected
			},
			ui: ala.recipes.ui
		});
		ala.lightbox();
		e.stopPropagation();
		e.preventDefault();
		return false;
	});

	$("form#form-account-settings").submit(function(e){
		if($("#new-password").val() != $("#confirm-new-password").val()){
			ala.snack("'New Password' and 'Confirm New Password' fields don't match.");
			e.preventDefault();
			e.stopPropagation();
			return false;
		}
		var xhr = new XMLHttpRequest();
		xhr.open("POST", "/user/update", true);
		xhr.onload = function(){
			if(this.status == 200){
				ala.snack("Account updated succesfully.  Refreshing...");
				setTimeout(function(){
					location.reload();
				}, 2000);
			} else {
				ala.snack(this.responseText);
				ala.setLoading(false);
			}
		}
		xhr.setRequestHeader("Content-Type", "application/json");
		var updates = {
			screenName: $("#screen-name").val()
		};
		if($("#new-password").val() != ""){
			updates.password = $("#new-password").val();
		}
		if($("ala-color-swatch.active").size() == 1){
			updates.color = $("ala-color-swatch.active").attr("color");
		}
		xhr.send(JSON.stringify({
			email: $.cookie("email"),
			password: $("#current-password").val(),
			updates: updates
		}));
		ala.setLoading(true);
		e.stopPropagation();
		e.preventDefault();
		return false;
	});

	$("form#form-new-chat").submit(function(e){
		if($("#form-new-chat #title").val() == ""){
			$("#form-new-chat #title").focus();
			ala.snack("Enter a title for the new chat.");
			e.stopPropagation();
			e.preventDefault();
			return false;
		}
		pushEmailEntry();
		var xhr = new XMLHttpRequest();
		xhr.open("POST", "/chat/new", true);
		xhr.onload = function(){
			if(this.status == 200){
				ala.snack("Chat created.");
				ala.lightbox("");
			} else {
				ala.snack(this.responseText);
			}
			ala.setLoading(false);
		}
		xhr.setRequestHeader("Content-Type", "application/json");
		var users = [];
		$("#form-new-chat ala-user-list ala-user").each(function(ind, el){
			users.push($(el).attr("user-email"));
		});
		xhr.send(JSON.stringify({
			email: $.cookie("email"),
			authToken: $.cookie("authToken"),
			title: $("#form-new-chat #title").val(),
			users: users
		}));
		ala.setLoading(true);
		e.stopPropagation();
		e.preventDefault();
		return false;
	})

	var renderSuggestion = function(suggestion){
		return "<ala-email-suggestion>" + suggestion + "</ala-email-suggestion>"
	}

	$("#email-entry").textext({
		plugins: "autocomplete",
		autoComplete: {
			dropdownMaxHeight: "200px",
			render: renderSuggestion
		},
		html: {
			dropdown: "<ala-suggestion-dropdown class='text-dropdown'><ala-suggestion-list class='text-list'/></ala-suggestion-dropdown>",
			suggestion: "<ala-suggestion class='text-suggestion'><ala-suggestion-text class='text-label'/></ala-suggestion>"
		}
	}).bind("getSuggestions", function(e, data){
		var list = ala.user.contacts;
		var te = $(e.target).textext()[0];
		var query = (data ? data.query : "") || "";
		$(this).trigger("setSuggestions", {result: te.itemManager().filter(list, query)});
	});

	var pushEmailEntry = function(){
		if($("#form-new-chat #email-entry").val() == ""){
			return;
		}
		if($("#form-new-chat ala-user[email='" + $("#form-new-chat #email-entry").val().trim() + "']").size() > 0){
			$("#form-new-chat #email-entry").val("");
			e.stopPropagation();
			e.preventDefault();
			return false;
		}
		var xhr = new XMLHttpRequest();
		xhr.open("GET", "/user/" + encodeURI($("#form-new-chat #email-entry").val().trim()), true);
		xhr.onload = function(){
			$("#form-new-chat #email-entry").prop("disabled", false);
			if(this.status == 200){
				var data = JSON.parse(this.responseText);
				data.removable = true;
				$("#form-new-chat ala-user-list").append(Handlebars.templates["user-chip"](data));
				$("#form-new-chat #email-entry").val("").focus();
			} else {
				ala.snack(this.responseText);
			}
		};
		xhr.send();
		$("#form-new-chat #email-entry").prop("disabled", true);
	}
	$("#form-new-chat #email-entry").keydown(function(e){
		if(e.keyCode == 13){
			setTimeout(pushEmailEntry, 100); // oh dear, someone please find something better
			e.stopPropagation();
			e.preventDefault();
			return false;
		}
	});
});
