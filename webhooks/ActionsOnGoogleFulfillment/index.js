const { conversation } = require('@assistant/conversation');
const functions = require('firebase-functions');
const admin = require('firebase-admin');

//Initialize firestore database
admin.initializeApp(functions.config().firebase);
const db = admin.firestore();

const app = conversation();

const userRef = db.collection('user');

function phoneValidation(phoneString) {
  return phoneString.match(/\d/g).length===10;
}

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

app.handle('userLogin', async conv => {
  // Implement your code here
  const userName = conv.scene.slots.name.value;
  const password = conv.scene.slots.phone.value;

  console.log(userName);
  console.log(password);
  //query
  var query = userRef.where('name', '==', `${userName}`).where('phoneNum', '==', `${password}`).limit(1);

  //get data
  const snapShot = await query.get();
  if(snapShot.empty) {
    conv.add("ไม่มีบัญชีนี้ในระบบนะ");
    conv.session.params.name = null;
    conv.session.params.phone = null;
    conv.scene.next.name = "askRegister";

  } else {
    //get firt doc array data
    const data = snapShot.docs[0].data();
    console.log(data);
    conv.session.params.name = data.name;
    conv.add(`ยินดีต้อนรับค่ะ คุณ${data.name}`);
  }
});

app.handle('userAccValidation', async conv => {

  if(conv.scene.slots.name.updated) {
    const userName = conv.scene.slots.name.value;
    // conv.session.params.name = userName;

  }

  if(conv.scene.slots.phone.updated) {
    const phone = conv.scene.slots.phone.value;
    const phoneFix = phone.replace(/\s/g,'');

    if (phoneValidation(phoneFix)) {
      conv.scene.slots.phone.value = phoneFix;
      // conv.session.params.phone = phoneFix;
    } else {
      conv.add('คุณบอกหมายเลขผิด');
      conv.scene.slots.phone.status = 'INVALID';
    }
  }
  
});

app.handle('userRegister', async conv => {
  //Do accout query
  const userName = conv.session.params.name;
  const password = conv.session.params.phone;

  console.log(userName);
  console.log(password);
  //query
  var query = userRef.where('name', '==', `${userName}`).where('phoneNum', '==', `${password}`).limit(1);

  //get data
  const snapShot = await query.get();
  if(snapShot.empty) {
    const batch = db.batch();
    const newUserRef = userRef.doc();
    batch.set(newUserRef, {name: `${userName}`, phoneNum: `${password}`});
    const isSuccess = await batch.commit();
    console.log(isSuccess);
    conv.add(`ลงทะเบียนเรียบร้อย ยินดีต้อนรับค่ะคุณ ${userName}`);

  } else {
    conv.add('คุณลงสมัครสมาชิกไปแล้วนะ');
    //get firt doc array data
    const data = snapShot.docs[0].data();
    console.log(data);
    conv.scene.next.name = "askLogin";
  }
});

exports.ActionsOnGoogleFulfillment = functions.https.onRequest(app);
