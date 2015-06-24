$(document).ready(function(){
	$("#log-in").click(function(){
		$("#button-bar").removeClass("hidden fade-in slide-up anim-delay skip-animation-in skip-animation-out").addClass("fade-out slide-down");
		$("#form-login").removeClass("hidden fade-out slide-down skip-animation-in skip-animation-out").addClass("fade-in slide-up");
		setTimeout(function(){
			$("#button-bar").addClass("hidden");
		}, 800);
	});

	$("#register").click(function(){
		$("#button-bar").removeClass("hidden fade-in slide-up anim-delay skip-animation-in skip-animation-out").addClass("fade-out slide-down");
		$("#form-register").removeClass("hidden fade-out slide-down skip-animation-in skip-animation-out").addClass("fade-in slide-up");
		setTimeout(function(){
			$("#button-bar").addClass("hidden");
		}, 800);
	});

	$("#login-back, #register-back").click(function(e){
		$("ala-entrance form").removeClass("fade-in slide-up anim-delay skip-animation-in skip-animation-out").addClass("fade-out slide-down");
		$("#button-bar").removeClass("hidden fade-out slide-down skip-animation-in skip-animation-out").addClass("fade-in slide-up");
		setTimeout(function(){
			$("ala-entrance form").addClass("hidden");
		}, 800);
		e.stopPropagation();
		return false;
	});

	$("#recover-back").click(function(e){
		$("#form-recover").removeClass("fade-in slide-up anim-delay skip-animation-in skip-animation-out").addClass("fade-out slide-down");
		$("#form-login").removeClass("hidden fade-out slide-down skip-animation-in skip-animation-out").addClass("fade-in slide-up");
		setTimeout(function(){
			$("#form-recover").addClass("hidden");
		}, 800);
		e.stopPropagation();
		return false;
	});

	$("#open-recover").click(function(e){
		$("#form-login").removeClass("fade-in slide-up anim-delay skip-animation-in skip-animation-out").addClass("fade-out slide-down");
		$("#form-recover").removeClass("hidden fade-out slide-down skip-animation-in skip-animation-out").addClass("fade-in slide-up");
		setTimeout(function(){
			$("#form-login").addClass("hidden");
		}, 800);
		e.stopPropagation();
		return false;
	});


	$("form#form-login").submit(function(e){
		$("#form-login #login-submit").addClass("hidden");
		var xhr = new XMLHttpRequest();
		xhr.open("POST", "/user/auth", true);
		xhr.onload = function(){
			if(this.status == 200){
				$.cookie("email", $("#form-login #email").val(), {expires: 30, path: "/"});
				$.cookie("authToken", this.responseText, {expires: 30, path: "/"});
				ala.onLogin();
			} else {
				$("#form-login #login-submit").removeClass("hidden");
				ala.snack(this.responseText);
			}
			ala.setLoading(false);
		}
		xhr.setRequestHeader("Content-Type", "application/json");
		xhr.send(JSON.stringify({
			email: $("#form-login #email").val(),
			password: $("#form-login #password").val()
		}));
		ala.setLoading(true);
		e.stopPropagation();
		e.preventDefault();
	});

	$("form#form-register").submit(function(e){
		if($("#form-register #password").val() == ""){
			ala.snack("Please enter a password.");
		} else if($("#form-register #password").val() != $("#form-register #confirm-password").val()){
			ala.snack("\"Password\" and \"Confirm Password\" fields don't match.");
		}
		$("#form-register #register-submit").addClass("hidden");
		var xhr = new XMLHttpRequest();
		xhr.open("POST", "/user/new", true);
		xhr.onload = function(){
			if(this.status == 200){
				var xhr = new XMLHttpRequest();
				xhr.open("POST", "/user/auth", true);
				xhr.onload = function(){
					if(this.status == 200){
						$.cookie("email", $("#form-register #email").val(), {expires: 30, path: "/"});
						$.cookie("authToken", this.responseText, {expires: 30, path: "/"});
						$("ala-entrance").addClass("authorized");
						ala.clearSnack();
						ala.chatInit();
						setTimeout(function(){
							ala.lightbox("form-welcome");
						}, 1000);
					} else {
						$("#form-register #register-submit").removeClass("hidden");
						ala.snack(this.responseText);
					}
					ala.setLoading(false);
				}
				xhr.setRequestHeader("Content-Type", "application/json");
				xhr.send(JSON.stringify({
					email: $("#form-register #email").val(),
					password: $("#form-register #password").val()
				}));
			} else {
				$("#form-register #register-submit").removeClass("hidden");
				ala.snack(this.responseText);
				ala.setLoading(false);
			}
		}
		xhr.setRequestHeader("Content-Type", "application/json");
		xhr.send(JSON.stringify({
			email: $("#form-register #email").val(),
			password: $("#form-register #password").val()
		}));
		ala.setLoading(true);
		e.stopPropagation();
		e.preventDefault();
	});

	$("form#form-recover").submit(function(e){
		var xhr = new XMLHttpRequest();
		xhr.open("POST", "/user/reset-password", true);
		xhr.onload = function(){
			if(this.status == 200){
				ala.snack("An email has been sent containing a temporary password.");
			} else {
				ala.snack(this.responseText);
			}
			ala.setLoading(false);
		}
		xhr.setRequestHeader("Content-Type", "application/json");
		xhr.send(JSON.stringify({
			email: $("#form-recover #email").val()
		}));
		ala.setLoading(true);
		e.stopPropagation();
		e.preventDefault();
	});

	if($.cookie("email") && $.cookie("authToken")){
		$("#form-login #email").val($.cookie("email"));
		$("#log-in").trigger("click");
		$("h1, h2, #form-login").addClass("skip-animation-in");
		$("#button-bar").addClass("skip-animation-out");
	}
});