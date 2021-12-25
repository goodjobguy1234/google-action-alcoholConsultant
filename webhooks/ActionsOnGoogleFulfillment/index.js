const { conversation, Collection, Image, Card} = require('@assistant/conversation');
const functions = require('firebase-functions');
const admin = require('firebase-admin');

//Initialize firestore database
admin.initializeApp(functions.config().firebase);
const db = admin.firestore();

const app = conversation();

const userRef = db.collection('user');
const productRef = db.collection('product');
var currentArrQueryResult = null;

function phoneValidation(phoneString) {
  return phoneString.match(/\d/g).length === 10;
}

function intersect(array1, array2) {
  return array1.filter(n => array2.some(n2 => n.name == n2.name));
}

function union(array1, array2) {
  return [...new Set([...array1, ...array2])];
}

function getPercentQualifiedSign(signList) {
  let signString = [];
  switch (signList) {
    case "น้อยกว่า":
      signString.push("<");
      break;

    case "น้อยกว่าเท่ากับ":
      signString.push("<=");
      break;

    case "มากกว่า":
      signString.push(">");
      break;

    case "มากกว่าเท่ากับ":
      signString.push(">=");
      break;

    case "ระหว่าง":
      signString.push(">");
      signString.push("<");
      break;

    case "ถึง":
      signString.push(">");
      signString.push("<");
      break;

    case "เท่ากับ":
      signString.push("==");
      break;

    default:
      signString.push("==");
      break;
  }
  return signString;
}

function getOccasionArray(queryOccasion) {
  const occasion = [];
  queryOccasion.forEach(key => {
    switch (key) {
      case "ของขวัญ":
        occasion.push("gift");
        break;

      case "ครบรอบ":
        occasion.push("anniversary");
        break;

      case "ฉลอง":
        occasion.push("celebration");
        break;

      case "ธรรมดา":
        occasion.push("casual");
        break;

      case "มื้อเย็น":
        occasion.push("dinner");
        break;

      case "วันเกิด":
        occasion.push("birthday");
    }
  });
  return occasion;
}

async function getQueryTypeResult(type) {
  const queryArr = [];
  let query = await productRef.where('type', 'array-contains-any', type).get();
  query = query.docs;

  query.forEach(doc => {
    queryArr.push(doc.data());
  });
  return queryArr;
}

async function getQueryOccasionResult(occasionList) {
  const queryArr = [];
  let query = await productRef.where('occasion', 'array-contains-any', occasionList).get();
  query = query.docs;

  query.forEach(doc => {
    queryArr.push(doc.data());
  });
  return queryArr;
}

async function getQueryPercentResult(percentNum, qualified) {
  const queryArr = [];
  const signArr = getPercentQualifiedSign(qualified);
  let query = productRef;
  percentNum.forEach((number, index) => {
    query = query.where('percent', `${signArr[index]}`, number);
    console.log(`sign: ${signArr[index]} number: ${number}`);
  });

  query = await query.get();

  query.forEach(doc => {
    queryArr.push(doc.data());
    console.log(doc.data());
  });
  
  return queryArr;
}

async function getQueryNameResult(name) {
  let query = await productRef.where('name', '==', name).limit(1).get();
  var value = query.docs[0].data();
  return value;
}

async function getQueryRetailResult(priceNum, qualified) {
  const queryArr = [];
  const signArr = getPercentQualifiedSign(qualified);
  let query = productRef;

  priceNum.forEach((number, index) => {
    query = query.where('retail', `${signArr[index]}`, number);
  });

  query = await query.get();
 
  query.forEach(doc => {
    queryArr.push(doc.data());
  });
  
  return queryArr;
  
}

function generateCollectionEntries(data) {
  const entriesData = [];
  const keyItem = [];

  data.forEach(data => {
    const { thainame, name, retail, percent, image } = data;

    const imageResponse = new Image({
      url: image,
      alt: 'Google Assistant logo'
    });

    const entity = {
      name: `${name}`,
      synonyms: [`${thainame}`],
      display: {
        title: `${name}`,
        description: `นี่คือเหล้าชั้นยอด ราคา ${retail} บาท มีเปอร์เซ็น: ${percent} `,
        image: imageResponse
      }
    };
    entriesData.push(entity);

    keyItem.push({
      key: name
    });
  });
  return {
    "entriesData": entriesData,
    "keyItem": keyItem
  }
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

  //query
  var query = userRef.where('name', '==', `${userName}`).where('phoneNum', '==', `${password}`).limit(1);

  //get data
  const snapShot = await query.get();
  if (snapShot.empty) {
    conv.add("ไม่มีบัญชีนี้ในระบบนะ");
    conv.session.params.name = null;
    conv.session.params.phone = null;
    conv.scene.next.name = "askRegister";

  } else {
    //get firt doc array data
    const data = snapShot.docs[0].data();

    conv.session.params.name = data.name;
    conv.add(`ยินดีต้อนรับค่ะ คุณ${data.name}`);
  }
});

app.handle('userAccValidation', async conv => {

  if (conv.scene.slots['name'].updated) {
    const userName = conv.scene.slots['name'].value;
    // conv.session.params.name = userName;

  }

  if (conv.scene.slots['phone'].updated) {
    const phone = conv.scene.slots['phone'].value;
    const phoneFix = phone.replace(/\s/g, '');

    if (phoneValidation(phoneFix)) {
      conv.scene.slots['phone'].value = phoneFix;
      // conv.session.params.phone = phoneFix;
    } else {
      conv.add('คุณบอกหมายเลขผิด');
      conv.scene.slots['phone'].status = 'INVALID';
    }
  }

});

app.handle('userRegister', async conv => {
  //Do accout query
  const userName = conv.scene.slots['name'].value;
  const password = conv.scene.slots['phone'].value;

  //query
  var query = userRef.where('name', '==', `${userName}`).where('phoneNum', '==', `${password}`).limit(1);

  //get data
  const snapShot = await query.get();
  if (snapShot.empty) {
    const batch = db.batch();
    const newUserRef = userRef.doc();
    batch.set(newUserRef, { name: `${userName}`, phoneNum: `${password}` });
    const isSuccess = await batch.commit();

    conv.add(`ลงทะเบียนเรียบร้อย ยินดีต้อนรับค่ะคุณ ${userName}`);

  } else {
    conv.add('คุณลงสมัครสมาชิกไปแล้วนะ');
    //get firt doc array data
    const data = snapShot.docs[0].data();

    conv.scene.next.name = "askLogin";
  }
});

app.handle('queryResultFirstStepCollection', async conv => {
  const typeArr = conv.session.params.drinkType;
  const dataSet = await getQueryTypeResult(typeArr)
  currentArrQueryResult = dataSet;

  if (dataSet.length == 0) {
    console.log('no data');

  } else {
    const data = dataSet.slice(0, 10)

    const { entriesData, keyItem } = generateCollectionEntries(data)

    conv.session.typeOverrides = [{
      name: 'alcoholName',
      mode: 'TYPE_REPLACE',
      synonym: {
        entries: entriesData
      }
    }];

    conv.add(new Collection({
      title: 'ผลการค้นหา',
      subtitle: 'ค้นหาโดยชนิด',
      items: keyItem
    }));
  }

});

app.handle('queryResultSecondStepCollection', async conv => {
  const type = conv.session.params.drinkType;
  const queryOccasion = conv.session.params.occasion;
  conv.session.params.queryQualifier = "เท่ากับ";
  console.log(queryOccasion);

  var occasion = getOccasionArray(queryOccasion);
  const arrayType = ((type === undefined) ? [] : await getQueryTypeResult(type));
  const arrayOccasion = await getQueryOccasionResult(occasion);
  const dataSet = intersect(arrayType, arrayOccasion);
  const dataSetAlternative = union(arrayType, arrayOccasion);
  currentArrQueryResult = dataSet;

  let data = [];
  if (dataSet.length == 0) {
    console.log('no data');
    conv.add('ไม่มีผลลัพื์ที่คุณค้องการ นี่คือผลลัพธ์ที่ใกล้เคียงกับของคุณ');
    data = dataSetAlternative

  } else {
    data = dataSet
  }

  data = data.slice(0, 10) // get data 10 item
  const { entriesData, keyItem } = generateCollectionEntries(data)

  conv.session.typeOverrides = [{
    name: 'alcoholName',
    mode: 'TYPE_REPLACE',
    synonym: {
      entries: entriesData
    }
  }];

  conv.add(new Collection({
    title: 'ผลการค้นหา',
    subtitle: 'ค้นหาโดยโอกาสการกิน',
    items: keyItem
  }));
});

app.handle('queryResultThirdStepCollection', async conv => {
  const queryPercent = conv.session.params.percent; //array
  let percentQualified = conv.session.params.queryQualifier;
  percentQualified = (percentQualified === undefined)? "เท่ากับ": percentQualified;
 
  const arrayPercent = await getQueryPercentResult(queryPercent, percentQualified);
  let dataSet;
  let dataSetAlternative;

  if(currentArrQueryResult === null){
    dataSet = arrayPercent;
  } else {
    dataSet = intersect(currentArrQueryResult, arrayPercent);
    dataSetAlternative = union(currentArrQueryResult, arrayPercent);
    currentArrQueryResult = dataSet;
  }

  let data = [];
  if (dataSet.length == 0) {
    conv.add('ไม่มีผลลัพื์ที่คุณค้องการ นี่คือผลลัพธ์ที่ใกล้เคียงกับของคุณ');
    data = dataSetAlternative;

  } else {
    data = dataSet;
  }

  data = data.slice(0, 10); // get data 10 item
  const { entriesData, keyItem } = generateCollectionEntries(data);

  conv.session.typeOverrides = [{
    name: 'alcoholName',
    mode: 'TYPE_REPLACE',
    synonym: {
      entries: entriesData
    }
  }];

  conv.add(new Collection({
    title: 'ค้นหาโดยเปอร์เซ็นแอลกอฮอล์',
    subtitle: 'ค้นหาโดยเปอร์เซ็นแอลกอฮอล์',
    items: keyItem
  }));

});

app.handle('queryResultForthStepCollection', async conv => {
  const retailCost = conv.session.params.retailCost;
  let qualified = conv.session.params.qualifier;
  qualified = (qualified === undefined)? "เท่ากับ": qualified;
  console.log(qualified);
 
  const arrayPrice = await getQueryRetailResult(retailCost, qualified);
  let dataSet;
  let dataSetAlternative;

  if(currentArrQueryResult === null){
    dataSet = arrayPrice;
  } else {
    dataSet = intersect(currentArrQueryResult, arrayPrice);
    dataSetAlternative = union(currentArrQueryResult, arrayPrice);
    currentArrQueryResult = dataSet;
  }

  let data = [];
  if (dataSet.length == 0) {
    conv.add('ไม่มีผลลัพื์ที่คุณค้องการ นี่คือผลลัพธ์ที่ใกล้เคียงกับของคุณ');
    data = dataSetAlternative;

  } else {
    data = dataSet;
  }

  
  data = data.slice(0, 10); // get data 10 item
  const { entriesData, keyItem } = generateCollectionEntries(data);

  conv.session.typeOverrides = [{
    name: 'alcoholName',
    mode: 'TYPE_REPLACE',
    synonym: {
      entries: entriesData
    }
  }];

  conv.add(new Collection({
    title: 'ค้นหาโดยเปอร์เซ็นแอลกอฮอล์',
    subtitle: 'ค้นหาโดยเปอร์เซ็นแอลกอฮอล์',
    items: keyItem
  }));

});

app.handle('selectionResponse', async conv => {
  const selectedOption = conv.session.params.alcoholName;
  const itemData = await getQueryNameResult(selectedOption);
  if(itemData !== null) {
    conv.session.params.itemData = itemData;
    conv.scene.next.name = "confirmProductSelection";
  }
  // pop up error
});

app.handle('confirmSelectedProductCard', conv => {
  const itemData = conv.session.params.itemData;
  conv.add(new Card({
    "title": itemData.name,
    "subtitle": "Card Subtitle",
    "text": "Card Content",
    "image": new Image({
      url: itemData.image,
      alt: 'Google Assistant logo'
    })
  }));
});

exports.ActionsOnGoogleFulfillment = functions.https.onRequest(app);
