const { GoogleAdsApi } = require('google-ads-api');
require('dotenv').config();

const config = {
  developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
  client_id: process.env.GOOGLE_ADS_CLIENT_ID,
  client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
  refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
};

console.log('Initializing Google Ads API client...');
const client = new GoogleAdsApi(config);

console.log('Client created. Available methods:', Object.keys(client).slice(0, 10));

const customerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
console.log(`\nCreating customer with ID: ${customerId}`);

const customer = client.Customer({ customer_id: customerId });

console.log('Customer created. Available properties:', Object.keys(customer));
console.log('Customer services:', Object.keys(customer).filter(k => k.includes('Service') || k.includes('service')));

// Check for keywordPlanIdeaService specifically
console.log('\nkeywordPlanIdeaService exists?', 'keywordPlanIdeaService' in customer);
console.log('Customer object keys:', Object.keys(customer).slice(0, 20));
