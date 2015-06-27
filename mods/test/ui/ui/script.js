document.onclick = function() {
	sendMessage({message:"clickity-click", name:"test/ui"})
}

registerMethod("postUI", function(data) {
	document.body.innerHTML = data.message
})
