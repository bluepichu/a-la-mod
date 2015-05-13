var https = require("https")
module.exports = function(mongo) {
	
}
function test() {
	var options = {
		hostname: 'android.googleapis.com',
		port: 443,
		path: '/gcm/send',
		method: 'POST',
		headers: {
			"Content-Type" :"application/json",
			"Authorization": "key=AIzaSyDXd3IVhR0fRLPZPr6BQAXg7Pup8cUD_GY"
		}
	};

	var req = https.request(options, function(res) {
		console.log("statusCode: ", res.statusCode);
		console.log("headers: ", res.headers);

		res.on('data', function(d) {
			process.stdout.write(d);
		});
	});
	req.write("{\"registration_ids\":[\"APA91bF7vqyJOJsVqnrlrQ4zTGnLZ4CnqL_yq5fkt4vhGazoJE4O-l6xIceiEh1AtXNsMI_0dCjzRF3g6y8cUXuOsxeZW7KE2FHg2FNzwatBbbPltS-yT9las4XbEwm3VLLD6Dz3Fm1MLOhxQHGNIWHvyw-_ngLNg9VYwHVjdiFwKfPEs7XpG1A\"]}")
	req.end();

	req.on('error', function(e) {
		console.error(e);
	});	
}

module.exports.prototype = {
	test: test,
}
