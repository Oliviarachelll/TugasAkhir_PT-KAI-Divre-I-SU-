require('dotenv').config();

const testWa = async () => {
  const accessToken = process.env.META_WA_ACCESS_TOKEN;
  const phoneNumberId = process.env.META_WA_PHONE_NUMBER_ID;
  const apiVersion = process.env.META_WA_API_VERSION || 'v25.0';

  const rawNumber1 = '083181568152';
  const rawNumber2 = "083193721866";
  const rawNumber = rawNumber1; // testing the first one

  let phone = rawNumber.replace(/\D/g, '');
  if (phone.startsWith('0')) {
    phone = '62' + phone.substring(1);
  }

  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
  
  // Test with text message (Requires 24h open window, so user must chat first)
  const payload = {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'text',
    text: {
      body: 'Halo! Ini adalah pesan pengujian dari server.'
    }
  };

  console.log(`Mengirim pesan template hello_world ke ${phone} via v25.0...`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log("Response Meta API:", JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Fetch Error:", error);
  }
};

testWa();
