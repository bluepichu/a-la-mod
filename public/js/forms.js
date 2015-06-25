$(document).ready(function(){
	$("ala-icon#mods").click(function(){
		ala.lightbox("form-mods");
		$("#form-mods #mods-enc").val(ala.recipes.encoding.selected.mods.join(" "));
		$("#form-mods #mods-dec").val(ala.recipes.decoding.selected.mods.join(" "));
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
			mods: $("#mods-enc").val().split(/\s+/g)
		}

		ala.recipes.decoding.selected = {
			title: "TODO",
			description: "TODO",
			mods: $("#mods-dec").val().split(/\s+/g)
		}

		localStorage.recipes = JSON.stringify({
			encoding: {
				selected: ala.recipes.encoding.selected
			},
			decoding: {
				selected: ala.recipes.decoding.selected
			}
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
});