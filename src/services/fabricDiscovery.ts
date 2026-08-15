import {
  getItemDefinitionToken,
  getItemToken,
  getWorkspaceToken,
} from './fabricAuth';

const FABRIC_API = 'https://api.fabric.microsoft.com/v1';

export interface FabricWorkspace {
  id: string;
  displayName: string;
}

export interface FabricItem {
  id: string;
  displayName: string;
  type: string;
  workspaceId: string;
}

interface ListResponse<T> {
  value: T[];
  continuationUri?: string | null;
}

async function getAll<T>(firstUrl: string, token: string): Promise<T[]> {
  const items: T[] = [];
  let url: string | null = firstUrl;

  while (url) {
    const response: Response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error(
          'Fabric denied the request. The app registration is missing a delegated permission, or admin consent has not been granted.'
        );
      }
      throw new Error(`Fabric REST API returned ${response.status}.`);
    }

    const page = (await response.json()) as ListResponse<T>;
    items.push(...(page.value ?? []));
    url = page.continuationUri ?? null;
  }

  return items;
}

/** Every workspace the signed-in user can see — Fabric filters this, not the app. */
export async function listWorkspaces(
  loginHint?: string
): Promise<FabricWorkspace[]> {
  const token = await getWorkspaceToken(loginHint);
  const workspaces = await getAll<FabricWorkspace>(
    `${FABRIC_API}/workspaces`,
    token
  );
  return workspaces.sort((a, b) =>
    a.displayName.localeCompare(b.displayName)
  );
}

/**
 * GraphQL API items are the only browser-reachable query surface for Warehouse
 * and SQL Database, so they are what the source picker offers.
 */
export async function listGraphqlApis(
  workspaceId: string,
  loginHint?: string
): Promise<FabricItem[]> {
  const token = await getItemToken(loginHint);
  const items = await getAll<Omit<FabricItem, 'workspaceId'>>(
    `${FABRIC_API}/workspaces/${workspaceId}/items?type=GraphQLApi`,
    token
  );
  return items
    .map((item) => ({ ...item, workspaceId }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export interface FabricUser {
  id: string;
  displayName: string;
  email: string;
  role: string;
}

interface RoleAssignment {
  id: string;
  role: string;
  principal: {
    id: string;
    displayName: string;
    type: string;
    userDetails?: { userPrincipalName?: string };
  };
}

/**
 * Workspace role assignments are the only user list reachable with the scopes the
 * app already holds, and they answer the question that matters: who Fabric has
 * already let in here. Groups and service principals carry no address, so only
 * user principals come back. Requires Member or higher on the workspace.
 */
export async function listWorkspaceUsers(
  workspaceId: string,
  loginHint?: string
): Promise<FabricUser[]> {
  const token = await getWorkspaceToken(loginHint);
  const assignments = await getAll<RoleAssignment>(
    `${FABRIC_API}/workspaces/${workspaceId}/roleAssignments`,
    token
  );

  return assignments
    .flatMap((assignment) => {
      const email = assignment.principal.userDetails?.userPrincipalName;
      if (assignment.principal.type !== 'User' || !email) return [];
      return [
        {
          id: assignment.principal.id,
          displayName: assignment.principal.displayName,
          email,
          role: assignment.role,
        },
      ];
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

/**
 * Fabric does not return the GraphQL endpoint as an item property, so it is
 * derived from the documented route. An admin can override it per source when
 * a workspace sits behind a regional host.
 */
export function deriveGraphqlEndpoint(
  workspaceId: string,
  graphqlApiId: string
): string {
  return `${FABRIC_API}/workspaces/${workspaceId}/graphqlapis/${graphqlApiId}/graphql`;
}

/** Stable identity for a source, used as the audit and config partition key. */
export function sourceKey(workspaceId: string, itemId: string): string {
  return `${workspaceId}/${itemId}`;
}

const SOURCE_TYPE_LABELS: Record<string, string> = {
  Warehouse: 'Warehouse',
  SqlDbNative: 'SQL database',
  SqlAnalyticsEndpoint: 'SQL analytics endpoint',
  AzureSql: 'Azure SQL database',
};

export interface TableBinding {
  /** GraphQL type name, which matches the entity name from introspection. */
  graphqlType: string;
  /** Fully qualified object in the source, e.g. `dbo.asset_details`. */
  sourceObject: string;
  sourceObjectType: string;
  sourceType: string;
  sourceTypeLabel: string;
  sourceItemId: string;
  sourceWorkspaceId: string;
  sourceItemName: string;
  /** Operation enablement as configured on the API, e.g. `{ Update: 'Enabled' }`. */
  actions: Record<string, string>;
}

interface DefinitionPart {
  path: string;
  payload: string;
  payloadType: string;
}

interface GraphqlDefinition {
  datasources?: {
    sourceItemId?: string;
    sourceWorkspaceId?: string;
    sourceType?: string;
    objects?: {
      graphqlType?: string;
      sourceObject?: string;
      sourceObjectType?: string;
      actions?: Record<string, string>;
    }[];
  }[];
}

function decodeBase64Json<T>(payload: string): T {
  const binary = atob(payload);
  const bytes = Uint8Array.from(binary, (char) => char.codePointAt(0) ?? 0);
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

/** Resolves an item's display name once per item, falling back to its id. */
async function resolveItemName(
  workspaceId: string,
  itemId: string,
  token: string,
  cache: Map<string, string>
): Promise<string> {
  const cacheKey = `${workspaceId}/${itemId}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  let name = itemId;
  try {
    const response = await fetch(
      `${FABRIC_API}/workspaces/${workspaceId}/items/${itemId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (response.ok) {
      const item = (await response.json()) as { displayName?: string };
      name = item.displayName ?? itemId;
    }
  } catch {
    name = itemId;
  }

  cache.set(cacheKey, name);
  return name;
}

/** Blocks until the operation succeeds, or throws with Fabric's failure detail. */
async function waitForOperation(
  statusUrl: string,
  headers: Record<string, string>
): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const poll = await fetch(statusUrl, { headers });
    if (!poll.ok) {
      throw new Error(`Fabric returned ${poll.status} polling the operation.`);
    }
    const state = (await poll.json()) as { status?: string; error?: unknown };
    if (state.status === 'Succeeded') return;
    if (state.status === 'Failed' || state.status === 'Undefined') {
      throw new Error(
        `The definition operation failed: ${JSON.stringify(state.error ?? state)}`
      );
    }
  }
  throw new Error('Timed out waiting for the item definition.');
}

/**
 * getDefinition usually answers 202. The Location header then returns operation
 * *status*, not the payload — the definition has to be read from the operation's
 * result endpoint once it succeeds.
 */
async function postForDefinition(
  url: string,
  token: string
): Promise<{ definition?: { parts?: DefinitionPart[] } }> {
  const headers = { Authorization: `Bearer ${token}` };
  const response = await fetch(url, { method: 'POST', headers });

  if (response.status !== 202) {
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(
        `Fabric returned ${response.status} for the item definition. ${detail}`.trim()
      );
    }
    return (await response.json()) as {
      definition?: { parts?: DefinitionPart[] };
    };
  }

  const operationId = response.headers.get('x-ms-operation-id');
  const location = response.headers.get('Location');
  if (!operationId && !location) {
    throw new Error(
      'Fabric accepted the definition request but returned no operation to poll.'
    );
  }

  await waitForOperation(
    location ?? `${FABRIC_API}/operations/${operationId}`,
    headers
  );

  const resultUrl = operationId
    ? `${FABRIC_API}/operations/${operationId}/result`
    : `${location}/result`;
  const result = await fetch(resultUrl, { headers });
  if (!result.ok) {
    const detail = await result.text().catch(() => '');
    throw new Error(
      `Fabric returned ${result.status} for the definition result. ${detail}`.trim()
    );
  }
  return (await result.json()) as { definition?: { parts?: DefinitionPart[] } };
}

/**
 * Reads which source object backs each GraphQL type. Introspection cannot report
 * this — the schema exposes entities, not the warehouse, schema, or table behind
 * them. Throws so the caller can show why the binding is missing.
 */
export async function loadTableBindings(
  workspaceId: string,
  graphqlApiId: string,
  loginHint?: string
): Promise<Map<string, TableBinding>> {
  const bindings = new Map<string, TableBinding>();
  const token = await getItemDefinitionToken(loginHint);

  const body = await postForDefinition(
    `${FABRIC_API}/workspaces/${workspaceId}/items/${graphqlApiId}/getDefinition`,
    token
  );

  const part = body.definition?.parts?.find((p) =>
    p.path.endsWith('graphql-definition.json')
  );
  if (!part) {
    const seen =
      body.definition?.parts?.map((p) => p.path).join(', ') || 'no parts at all';
    throw new Error(
      `The API definition has no graphql-definition.json part. Fabric returned: ${seen}.`
    );
  }

  const definition = decodeBase64Json<GraphqlDefinition>(part.payload);
  const nameCache = new Map<string, string>();

  for (const source of definition.datasources ?? []) {
    const sourceWorkspaceId = source.sourceWorkspaceId ?? workspaceId;
    const sourceItemId = source.sourceItemId ?? '';
    const sourceItemName = sourceItemId
      ? await resolveItemName(sourceWorkspaceId, sourceItemId, token, nameCache)
      : '';

    for (const object of source.objects ?? []) {
      if (!object.graphqlType) continue;
      bindings.set(object.graphqlType, {
        graphqlType: object.graphqlType,
        sourceObject: object.sourceObject ?? '',
        sourceObjectType: object.sourceObjectType ?? 'Table',
        sourceType: source.sourceType ?? '',
        sourceTypeLabel:
          SOURCE_TYPE_LABELS[source.sourceType ?? ''] ?? source.sourceType ?? '',
        sourceItemId,
        sourceWorkspaceId,
        sourceItemName,
        actions: object.actions ?? {},
      });
    }
  }

  return bindings;
}

