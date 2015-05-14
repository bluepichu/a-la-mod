'use strict';

self.addEventListener('push', function(event) {
	console.log('Received a push message', event);

	var title = 'Yay a message.';
	var body = 'We have received a push message at '+(new Date()).getMinutes();
	var icon = '/images/icon-192x192.png';
	var tag = 'simple-push-demo-notification-tag';

	event.waitUntil(
		registration.pushManager.getSubscription().then(function(ps) {
			console.log(ps.subscriptionId)
			fetch("/push/get/"+ps.subscriptionId).then(function(res) {
				res.json().then(function(data) {
						self.registration.showNotification(data.title || title, {
						body: data.body || body,
						icon: data.icon || icon,
						tag: data.tag || tag
					})
				 })
			})

		})
	);
});


self.addEventListener('notificationclick', function(event) {
	console.log('On notification click: ', event.notification.tag);
	// Android doesn’t close the notification when you click on it
	// See: http://crbug.com/463146
	event.notification.close();

	// This looks to see if the current is already open and
	// focuses if it is
	event.waitUntil(clients.matchAll({
		type: "window"
	}).then(function(clientList) {
		for (var i = 0; i < clientList.length; i++) {
			var client = clientList[i];
			if (client.url == '/' && 'focus' in client)
				return client.focus();
		}
		if (clients.openWindow)
			return clients.openWindow('/?why-you-no-work');
	}));
});
