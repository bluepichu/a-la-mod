$.fn.redraw = function(){
	$(this).each(function(){
		var redraw = this.offsetHeight;
	});
};

$.fn.capturePosition = function(){
	$(this).each(function(){
		var obj = $(this).offset();
		obj.width = $(this).outerWidth();
		obj.height = $(this).outerHeight();
		$(this).data("position", obj);
	});
}

$.fn.animateReposition = function(){
	$(this).each(function(){
		$(this).css({
			left: 0,
			top: 0
		});
		
		$(this).css({
			width: $(this).data("position").width,
			height: $(this).data("position").height
		});
		var pos = $(this).offset();
		$(this).css({
			transition: "none",
			position: "relative",
			left: $(this).data("position").left - pos.left,
			top: $(this).data("position").top - pos.top
		});
		$(this).redraw();
		$(this).css({
			transition: "",
			left: 0,
			top: 0,
			width: "",
			height: ""
		});
	});
}

$.fn.animateRepositionReverse = function(){
	$(this).each(function(){
		var pos = $(this).offset();
		$(this).css({
			position: "relative",
			left: $(this).data("position").left - pos.left,
			top: $(this).data("position").top - pos.top,
			width: $(this).data("position").width,
			height: $(this).data("position").height
		});
	});
}