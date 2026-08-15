import {
  InteractionRequiredAuthError,
  PublicClientApplication,
  type AccountInfo,
} from '@azure/msal-browser';

/**
 * Entra issues one audience per token, so the GraphQL data plane and the Fabric
 * REST control plane must be requested separately — they cannot be combined.
 */
const GRAPHQL_SCOPES = [
  'https://analysis.windows.net/powerbi/api/GraphQLApi.Execute.All',
];
const WORKSPACE_SCOPES = ['https://api.fabric.microsoft.com/Workspace.Read.All'];
const ITEM_SCOPES = ['https://api.fabric.microsoft.com/Item.Read.All'];
/** getDefinition is a write-tier operation, so Item.Read.All is not enough. */
const ITEM_DEFINITION_SCOPES = [
  'https://api.fabric.microsoft.com/Item.ReadWrite.All',
];

const clientId = import.meta.env.VITE_FABRIC_GRAPHQL_CLIENT_ID as
  | string
  | undefined;
const tenantId = import.meta.env.VITE_FABRIC_TENANT_ID as string | undefined;

/**
 * MSAL v5 delivers the popup result over a BroadcastChannel opened by whatever
 * page the redirect URI loads, so that page must run the redirect bridge. The
 * app origin cannot do it — it would boot the SPA inside the popup and the
 * router would normalise away the response before the bridge sees it.
 */
const REDIRECT_URI = `${window.location.origin}/auth-redirect.html`;

/** A popup that never completes would otherwise hang forever; MSAL has no overall timeout. */
const POPUP_TIMEOUT_MS = 3 * 60 * 1000;

let ready: Promise<PublicClientApplication> | null = null;

export function isFabricDataPlaneConfigured(): boolean {
  return Boolean(clientId && tenantId);
}

/**
 * A fresh page load means no interaction can still be running, so a leftover
 * status key is stale. Left behind by a cancelled popup it wedges MSAL with
 * `interaction_in_progress` on every subsequent attempt.
 */
function clearStaleInteraction(): void {
  for (const store of [window.sessionStorage, window.localStorage]) {
    for (const key of Object.keys(store)) {
      if (key.includes('interaction.status')) store.removeItem(key);
    }
  }
}

function getInstance(): Promise<PublicClientApplication> {
  if (!isFabricDataPlaneConfigured()) {
    return Promise.reject(
      new Error(
        'Fabric data plane is not configured. Set VITE_FABRIC_GRAPHQL_CLIENT_ID in .env.'
      )
    );
  }

  ready ??= (async () => {
    clearStaleInteraction();
    const instance = new PublicClientApplication({
      auth: {
        clientId: clientId as string,
        authority: `https://login.microsoftonline.com/${tenantId}`,
        redirectUri: REDIRECT_URI,
      },
      cache: { cacheLocation: 'sessionStorage' },
    });
    await instance.initialize();
    return instance;
  })();

  return ready;
}

function withTimeout<T>(work: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    work,
    new Promise<T>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              `${label} timed out. The sign-in window may have been blocked or closed.`
            )
          ),
        POPUP_TIMEOUT_MS
      )
    ),
  ]);
}

function pickAccount(instance: PublicClientApplication): AccountInfo | null {
  return instance.getAllAccounts()[0] ?? null;
}

async function acquire(scopes: string[], loginHint?: string): Promise<string> {
  const instance = await getInstance();
  const account = pickAccount(instance);

  if (account) {
    try {
      const silent = await instance.acquireTokenSilent({ scopes, account });
      return silent.accessToken;
    } catch (error) {
      if (!(error instanceof InteractionRequiredAuthError)) throw error;
    }
  }

  const result = await withTimeout(
    instance.acquireTokenPopup({ scopes, loginHint }),
    'Fabric sign-in'
  );
  return result.accessToken;
}

/** Token for executing queries against a Fabric API for GraphQL endpoint. */
export function getGraphqlToken(loginHint?: string): Promise<string> {
  return acquire(GRAPHQL_SCOPES, loginHint);
}

/** Token for listing workspaces the signed-in user can see. */
export function getWorkspaceToken(loginHint?: string): Promise<string> {
  return acquire(WORKSPACE_SCOPES, loginHint);
}

/** Token for listing items inside a workspace. */
export function getItemToken(loginHint?: string): Promise<string> {
  return acquire(ITEM_SCOPES, loginHint);
}

/** Token for reading an item's definition, which needs the write-tier scope. */
export function getItemDefinitionToken(loginHint?: string): Promise<string> {
  return acquire(ITEM_DEFINITION_SCOPES, loginHint);
}

/** Email of the Entra account backing the data-plane tokens, for audit attribution. */
export async function getSignedInUpn(): Promise<string | null> {
  const instance = await getInstance();
  const account = pickAccount(instance);
  return account?.username ?? null;
}
