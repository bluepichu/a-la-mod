module.exports = {
	createEmail : function(rcpt, body) {
		return "<div style=\"background-color:#1565C0; padding: 10px; max-width: 800px; margin: auto auto; border-radius: 10px\"><h1 style=\" font-family: 'Basic' sans-serif; text-align: center;font-size: 50px;color: #eee;\">À la Mod <img src=\"http://a-la-mod.com/images/app-icon-192.png\" style=\" max-height: 64px; top: 12px; position: relative;\"></h1><h2 style=\"font-family: 'Basic' sans-serif; color:#fff; margin-left:30px;\">Hello {{rcpt}},</h2><p style=\"font-family: 'Basic' sans-serif; color: #fff; margin: 10px\">{{body}}</p></div>".replace(/{{rcpt}}/g,rcpt).replace(/{{body}}/g,body);
	},
	sendEmail : function(sendgrid, dest, options) {
		options = options || {}
		options.fromname = "A-la-mod"
		var email = new sendgrid.Email(options);
    	email.addTo(dest);
    	email.setFrom("donotreply@a-la-mod.com");
    	sendgrid.send(email, function(err, data) {
        if (err) {
            console.log (err);
        } else {
            console.log(data);
        }
    });
	}
}