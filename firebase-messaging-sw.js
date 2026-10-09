importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyAJWHNvyuKt9yYoqfiz3NqjMZZQ92-Y348",
  authDomain: "sone-restaurant.firebaseapp.com",
  projectId: "sone-restaurant",
  storageBucket: "sone-restaurant.firebasestorage.app",
  messagingSenderId: "422050209675",
  appId: "1:422050209675:web:bec7cbc69d14467c4b598e"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('Background message received ', payload);
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: 'sonelogo.png',
        requireInteraction: true
    };
    self.registration.showNotification(notificationTitle, notificationOptions);
});
