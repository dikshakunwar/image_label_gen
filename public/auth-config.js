const poolData = {
  UserPoolId: 'ap-south-1_43cxTM9yg', // e.g. ap-south-1_AaBbCc123
  ClientId: '7m8hsr6kfenuvpktei9pnv6dal'   // e.g. 1234abcd5678efgh9012ijkl
};

const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
