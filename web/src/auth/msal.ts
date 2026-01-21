import {
  PublicClientApplication,
  type Configuration,
} from '@azure/msal-browser';

const tenantId = import.meta.env.VITE_ENTRA_TENANT_ID;
const clientId = import.meta.env.VITE_ENTRA_CLIENT_ID;

const config: Configuration = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'localStorage',
  },
};

export const msalInstance = new PublicClientApplication(config);

// Graph delegated scopes (make sure these exist on the App Registration)
export const graphScopes = {
  scopes: ['User.Read', 'Sites.ReadWrite.All'],
};
