import crypto from 'crypto';

// ✅ UPDATED: Accepts 'salt' as a second argument to match the Controller
export const generatePayUHash = (params: any, salt: string) => {
  // Formula: key|txnid|amount|productinfo|firstname|email|udf1...udf10|salt
  const hashString = `${params.key}|${params.txnid}|${params.amount}|${params.productinfo}|${params.firstname}|${params.email}|||||||||||${salt}`;
  
  return crypto.createHash('sha512').update(hashString).digest('hex');
};

export const verifyPayUHash = (response: any, salt: string) => {
  // Formula: salt|status|||||||||||email|firstname|productinfo|amount|txnid|key
  const hashString = `${salt}|${response.status}|||||||||||${response.email}|${response.firstname}|${response.productinfo}|${response.amount}|${response.txnid}|${response.key}`;
  
  return crypto.createHash('sha512').update(hashString).digest('hex') === response.hash;
};