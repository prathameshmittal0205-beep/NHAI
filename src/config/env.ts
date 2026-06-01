export const ENV = {
  // Switch this to 'prod' for the final deployment
  APP_ENV: 'dev' as 'dev' | 'prod',

  AWS_API_ENDPOINT: {
    dev: 'https://api.mock-nhai-datalake.com/sync',
    prod: 'https://q9w8e7r6t5.execute-api.ap-south-1.amazonaws.com/prod/attendance/sync',
  },

  get endpointUrl(): string {
    return this.AWS_API_ENDPOINT[this.APP_ENV];
  },

  // Never commit real encryption keys in source. 
  // This is a placeholder default. In production, this should be fetched securely.
  ENCRYPTION_KEY_FALLBACK: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2'
};
