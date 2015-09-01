$(document).ready(function(){
	$("ala-icon#mods").click(function(){
		ala.lightbox("form-mods");
		$("#form-mods #mods-enc").val(ala.recipes.all[ala.selected].encoders.join("\n"));
		$("#form-mods #mods-dec").val(ala.recipes.all[ala.selected].decoders.join("\n"));
		$("#form-mods #mods-ui").val(ala.recipes.all[ala.selected].uis.join("\n"));
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

	$("ala-icon#login").click(function(){
		ala.lightbox("form-login");
	});

	$("ala-icon#register").click(function(){
		ala.lightbox("form-register");
	});

	$("button#forgot-password").click(function(e){
		ala.lightbox("");
		setTimeout(function(){
			ala.lightbox("form-forgot-password");
		}, 400);
		e.preventDefault();
		e.stopPropagation();
		return false;
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

	$("form#form-login").submit(function(e){
		ala.setLoading(true);

		ala.fetch({
			method: "POST",
			url: "/user/auth",
			body: {
				email: $("#form-login #email").val(),
				password: $("#form-login #password").val()
			}
		})
			.then(function(data){
			$.cookie("email", $("#form-login #email").val(), {expires: 30, path: "/"});
			$.cookie("authToken", data.token, {expires: 30, path: "/"});
			ala.lightbox();
			setTimeout(function(){
				ala.onLogin();
			}, 800);
			ala.setLoading(false);
		})
			.catch(function(err){
			$("#form-login #login-submit").removeClass("hidden");
			ala.snack(err.errorText);
			ala.setLoading(false);
		});

		e.stopPropagation();
		e.preventDefault();
	});

	$("form#form-forgot-password").submit(function(e){
		ala.setLoading(true);

		ala.fetch({
			method: "POST",
			url: "/user/reset-password",
			body: {
				email: $("#form-forgot-password #email").val()
			}
		})
			.then(function(data){
			ala.lightbox();
			ala.snack("An email has been sent containing a temporary password.");
			ala.setLoading(false);
		})
			.catch(function(err){
			ala.snack(err.errorText);
			ala.setLoading(false);
		});

		e.stopPropagation();
		e.preventDefault();
	});

	$("form#form-register").submit(function(e){
		if($("#form-register #password").val() == ""){
			ala.snack("Please enter a password.");
			return;
		} else if($("#form-register #password").val() != $("#form-register #confirm-password").val()){
			ala.snack("\"Password\" and \"Confirm Password\" fields don't match.");
			return;
		}
		$("#form-register #register-submit").addClass("hidden");
		ala.setLoading(true);

		ala.fetch({
			method: "POST",
			url: "/user/new",
			body: {
				email: $("#form-register #email").val(),
				password: $("#form-register #password").val()
			}
		})
			.then(function(data){
			return ala.fetch({
				method: "POST",
				url: "/user/auth",
				body: {
					email: $("#form-register #email").val(),
					password: $("#form-register #password").val()
				}
			});
		})
			.then(function(data){
			$.cookie("email", $("#form-register #email").val(), {expires: 30, path: "/"});
			$.cookie("authToken", data.token, {expires: 30, path: "/"});
			ala.lightbox();
			setTimeout(function(){
				ala.onLogin();
				setTimeout(function(){
					ala.lightbox("form-welcome");
				}, 800);
			}, 800);
			ala.setLoading(false);
		})
			.catch(function(err){
			$("#form-register #register-submit").removeClass("hidden");
			ala.snack(err.errorText);
			ala.setLoading(false);
		});

		e.stopPropagation();
		e.preventDefault();
		return false;
	});

	$("form#form-welcome").submit(function(e){
		ala.lightbox();
		e.preventDefault();
		e.stopPropagation();
		return false;
	});

	$("form#form-mods").submit(function(e){	
		var delimiter = /[,;\s]+/g;

		var enc = $("#mods-enc").val().split(delimiter);
		ala.recipes.all[ala.selected].encoders = [];
		for (var m in enc) {
			if(!enc[m]){
				continue;
			}
			ala.recipes.all[ala.selected].encoders.push(enc[m]);
		}

		var dec = $("#mods-dec").val().split(delimiter);
		ala.recipes.all[ala.selected].decoders = [];
		for (var m in dec) {
			if(!dec[m]){
				continue;
			}
			ala.recipes.all[ala.selected].decoders.push(dec[m]);
		}

		var ui = $("#mods-ui").val().split(delimiter);
		ala.recipes.all[ala.selected].uis = [];
		for (var m in ui) {
			if(!ui[m]){
				continue;
			}
			ala.recipes.all[ala.selected].uis.push(ui[m]);
		}

		localStorage.recipes = JSON.stringify(ala.recipes);
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

		ala.setLoading(true);

		var updates = {
			screenName: $("#screen-name").val()
		};

		if($("#new-password").val() != ""){
			updates.password = $("#new-password").val();
		}

		if($("ala-color-swatch.active").size() == 1){
			updates.color = $("ala-color-swatch.active").attr("color");
		}

		ala.fetch({
			method: "POST",
			url: "/user/update",
			body: {
				email: $.cookie("email"),
				password: $("#current-password").val(),
				updates: updates
			}
		})
			.then(function(data){
			ala.snack("Account updated succesfully.  Refreshing...");
			setTimeout(function(){
				location.reload();
			}, 2000);
		})
			.catch(function(err){
			ala.snack(err.errorText);
			ala.setLoading(false);
		});

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
		ala.setLoading(true);

		var users = [];
		$("#form-new-chat ala-user-list ala-user").each(function(ind, el){
			users.push($(el).attr("user-email"));
		});

		ala.fetch({
			method: "POST",
			url: "/chat/new",
			body: {
				email: $.cookie("email"),
				authToken: $.cookie("authToken"),
				title: $("#form-new-chat #title").val(),
				users: users
			}
		})
			.then(function(){
			ala.snack("Chat created.");
			ala.lightbox("");
			ala.setLoading(false);
		})
			.catch(function(err){
			ala.snack(err.errorText);
			ala.setLoading(false);
		});

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

		ala.fetch({
			method: "GET",
			url: "/user/" + encodeURI($("#form-new-chat #email-entry").val().trim())
		})
			.then(function(data){
			$("#form-new-chat #email-entry").prop("disabled", false);
			data.removable = true;
			$("#form-new-chat ala-user-list").append(Handlebars.templates["user-chip"](data));
			$("#form-new-chat #email-entry").val("").focus();
		})
			.catch(function(err){
			$("#form-new-chat #email-entry").prop("disabled", false);
			ala.snack(err.errorText);
		});
		
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
