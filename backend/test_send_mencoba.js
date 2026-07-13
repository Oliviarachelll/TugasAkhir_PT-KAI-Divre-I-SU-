
require('dotenv').config();
async function testSend() {
  const accessToken = process.env.META_WA_ACCESS_TOKEN;
  const phoneNumberId = process.env.META_WA_PHONE_NUMBER_ID;
  const url = 'https://graph.facebook.com/v20.0/' + phoneNumberId + '/messages';
  
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: '6283181568152',
    type: 'template',
    template: {
      name: 'mencoba123',
      language: {
        code: 'id'
      }
    }
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    console.log('Response Status:', res.status);
    console.log('Response Data:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}
testSend();

