module.exports = {
	createEmail : function(rcpt, body) {
		return "<div style=\"background-color:#1565C0; padding: 10px\"><h1 style=\"color:#fff; font-family: 'Basic' sans-serif; text-align: center\">&Agrave; la Mod</h1><h2 style=\"font-family: 'Basic' sans-serif; color:#fff; margin-left:30px;\">Hello {{rcpt}},</h2><p style=\"font-family: 'Basic' sans-serif; color: #fff; margin: 10px\"> {{body}} </p></div>".replace(/{{rcpt}}/g,rcpt).replace(/{{body}}/g,body);
	},
	sendEmail : function(sendgrid, dest, options) {
		options = options || {}
		options.fromname = "A-la-mod"
		var email = new sendgrid.Email(options);
    	email.addTo(dest);
    	email.setFrom("donotreply@a-la-mod.herokuapp.com");
    	sendgrid.send(email, function(err, data) {
        if (err) {
            console.log (err);
        } else {
            console.log(data);
        }
    });
	}
}