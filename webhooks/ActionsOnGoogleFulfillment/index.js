const { conversation } = require('@assistant/conversation');
const functions = require('firebase-functions');
const admin = require('firebase-admin');

//Initialize firestore database
admin.initializeApp(functions.config().firebase);
const db = admin.firestore();

const app = conversation();



app.handle('helloWorld', async conv => {
  // Implement your code here
  const dbDoc = db.collection('Guy').doc('sample');
  await dbDoc.set({
  first: 'Ada',
  last: 'Lovelace',
  born: 1815
  });
  conv.add('Hello world from fulfillment');
  conv.scene.next.name = 'actions.scene.END_CONVERSATION';
});



exports.ActionsOnGoogleFulfillment = functions.https.onRequest(app);
