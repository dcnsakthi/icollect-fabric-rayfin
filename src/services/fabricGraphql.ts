import { getGraphqlToken } from './fabricAuth';

interface TypeRef {
  kind: string;
  name: string | null;
  ofType?: TypeRef | null;
}

interface InputValue {
  name: string;
  type: TypeRef;
}

interface FieldInfo {
  name: string;
  type: TypeRef;
  args?: InputValue[];
}

interface TypeInfo {
  kind: string;
  name: string;
  fields?: FieldInfo[] | null;
}

export interface FabricColumn {
  name: string;
  /** Underlying scalar, e.g. `String`, `Int`, `Boolean`, `DateTime`. */
  scalar: string;
  isNullable: boolean;
  isKey: boolean;
}

export interface FabricTable {
  entityName: string;
  listQuery: string;
  createMutation?: string;
  updateMutation?: string;
  deleteMutation?: string;
  /** Selection sets for the mutations' own return types, which are not the entity. */
  createSelection?: string;
  updateSelection?: string;
  deleteSelection?: string;
  keyFields: string[];
  columns: FabricColumn[];
  /** Every mutation the endpoint exposes, so a missing operation can be explained. */
  availableMutations: string[];
}

export class GraphqlError extends Error {}

const TYPE_REF = `
fragment T on __Type {
  kind name
  ofType { kind name
    ofType { kind name
      ofType { kind name
        ofType { kind name }
      }
    }
  }
}`;

const INTROSPECTION = `
query Introspect {
  __schema {
    queryType { name }
    mutationType { name }
    types {
      kind
      name
      fields(includeDeprecated: false) {
        name
        type { ...T }
        args { name type { ...T } }
      }
    }
  }
}
${TYPE_REF}`;

/** Strips NON_NULL and LIST wrappers down to the named type. */
function namedType(ref: TypeRef | null | undefined): string | null {
  let current = ref;
  while (current) {
    if (current.name) return current.name;
    current = current.ofType ?? null;
  }
  return null;
}

function isNonNull(ref: TypeRef | null | undefined): boolean {
  return ref?.kind === 'NON_NULL';
}

export async function execute<T>(
  endpoint: string,
  query: string,
  variables?: Record<string, unknown>,
  loginHint?: string
): Promise<T> {
  const token = await getGraphqlToken(loginHint);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new GraphqlError(
        'Fabric refused the query. Either the signed-in user lacks access to this data, or GraphQLApi.Execute.All has not been consented.'
      );
    }
    throw new GraphqlError(`Fabric GraphQL returned ${response.status}.`);
  }

  const payload = (await response.json()) as {
    data?: T;
    errors?: { message: string }[];
  };

  if (payload.errors?.length) {
    throw new GraphqlError(payload.errors.map((e) => e.message).join('; '));
  }
  if (!payload.data) throw new GraphqlError('Fabric GraphQL returned no data.');

  return payload.data;
}

const SCALAR_KINDS = new Set(['SCALAR', 'ENUM']);

/** Sources name entities inconsistently (asset_master vs AssetMaster), so compare loosely. */
function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findMutation(
  mutations: FieldInfo[],
  verb: string,
  entityName: string
): FieldInfo | undefined {
  const target = normalize(`${verb}${entityName}`);
  return mutations.find((m) => normalize(m.name) === target);
}

/**
 * Fabric mutations return `DbOperationResult`, not the row, so asking for the
 * entity's key columns is rejected. Read the selection set off the return type.
 */
function resultSelection(
  field: FieldInfo | undefined,
  byName: Map<string, TypeInfo>
): string | undefined {
  if (!field) return undefined;

  const returned = namedType(field.type);
  const type = returned ? byName.get(returned) : undefined;
  const scalars = (type?.fields ?? [])
    .filter((f) => {
      const name = namedType(f.type);
      const resolved = name ? byName.get(name) : undefined;
      return !resolved || SCALAR_KINDS.has(resolved.kind);
    })
    .map((f) => f.name);

  return scalars.length ? scalars.join(' ') : '__typename';
}

/**
 * Derives editable table descriptors from the endpoint's schema. Names are read
 * rather than assumed because each bound source generates its own operations.
 */
export async function introspect(
  endpoint: string,
  loginHint?: string
): Promise<FabricTable[]> {
  const data = await execute<{
    __schema: {
      queryType: { name: string };
      mutationType: { name: string } | null;
      types: TypeInfo[];
    };
  }>(endpoint, INTROSPECTION, undefined, loginHint);

  const { queryType, mutationType, types } = data.__schema;
  const byName = new Map(types.map((t) => [t.name, t]));
  const queryFields = byName.get(queryType.name)?.fields ?? [];
  const mutationFields = mutationType
    ? (byName.get(mutationType.name)?.fields ?? [])
    : [];

  const tables: FabricTable[] = [];

  for (const field of queryFields) {
    const connectionName = namedType(field.type);
    if (!connectionName) continue;

    const connection = byName.get(connectionName);
    const itemsField = connection?.fields?.find((f) => f.name === 'items');
    if (!itemsField) continue;

    const entityName = namedType(itemsField.type);
    if (!entityName) continue;

    const entity = byName.get(entityName);
    if (!entity?.fields) continue;

    const createMutation = findMutation(mutationFields, 'create', entityName);
    const updateMutation = findMutation(mutationFields, 'update', entityName);
    const deleteMutation = findMutation(mutationFields, 'delete', entityName);

    // The delete mutation's arguments are exactly the primary key columns,
    // which is more reliable than guessing an `id` convention.
    const keyFields = (deleteMutation?.args ?? []).map((a) => a.name);

    const columns: FabricColumn[] = entity.fields
      .filter((f) => {
        const typeName = namedType(f.type);
        const resolved = typeName ? byName.get(typeName) : undefined;
        return !resolved || SCALAR_KINDS.has(resolved.kind);
      })
      .map((f) => ({
        name: f.name,
        scalar: namedType(f.type) ?? 'String',
        isNullable: !isNonNull(f.type),
        isKey: keyFields.includes(f.name),
      }));

    if (!columns.length) continue;

    tables.push({
      entityName,
      listQuery: field.name,
      createMutation: createMutation?.name,
      updateMutation: updateMutation?.name,
      deleteMutation: deleteMutation?.name,
      createSelection: resultSelection(createMutation, byName),
      updateSelection: resultSelection(updateMutation, byName),
      deleteSelection: resultSelection(deleteMutation, byName),
      keyFields,
      columns,
      availableMutations: mutationFields.map((m) => m.name),
    });
  }

  return tables.sort((a, b) => a.entityName.localeCompare(b.entityName));
}

function selection(table: FabricTable): string {
  return table.columns.map((c) => c.name).join(' ');
}

/** GraphQL literal for a value, typed by the column's scalar. */
function literal(value: unknown, scalar: string): string {
  if (value === null || value === undefined || value === '') return 'null';
  if (scalar === 'Int' || scalar === 'Float' || scalar === 'Decimal') {
    return String(Number(value));
  }
  if (scalar === 'Boolean') return String(value === true || value === 'true');
  return JSON.stringify(String(value));
}

export type Row = Record<string, unknown>;

/**
 * Fabric only generates update/delete mutations for tables it can address by key,
 * so a missing operation usually means the source table has no primary key rather
 * than a naming mismatch. Report both possibilities with the evidence.
 */
function missingOperation(table: FabricTable, verb: string): GraphqlError {
  const related = table.availableMutations.filter((name) =>
    name.toLowerCase().includes(table.entityName.toLowerCase().replace(/[^a-z0-9]/g, ''))
  );
  const shown = (related.length ? related : table.availableMutations).slice(0, 12);

  return new GraphqlError(
    [
      `${table.entityName} does not expose a ${verb} operation.`,
      table.keyFields.length
        ? `Detected key columns: ${table.keyFields.join(', ')}.`
        : 'No key columns were detected, which is the usual cause — Fabric cannot generate update or delete mutations for a table it cannot address by key. Add a primary key on the source table (Warehouse requires NONCLUSTERED ... NOT ENFORCED) and refresh the GraphQL API.',
      shown.length
        ? `Mutations this endpoint exposes: ${shown.join(', ')}.`
        : 'This endpoint exposes no mutations at all, so it was published read-only.',
    ].join(' ')
  );
}

export async function fetchRows(
  endpoint: string,
  table: FabricTable,
  first: number,
  loginHint?: string
): Promise<Row[]> {
  const query = `query { ${table.listQuery}(first: ${first}) { items { ${selection(table)} } } }`;
  const data = await execute<Record<string, { items: Row[] }>>(
    endpoint,
    query,
    undefined,
    loginHint
  );
  return data[table.listQuery]?.items ?? [];
}

function scalarOf(table: FabricTable, column: string): string {
  return table.columns.find((c) => c.name === column)?.scalar ?? 'String';
}

function itemLiteral(table: FabricTable, values: Row, omitKeys: boolean): string {
  return Object.entries(values)
    .filter(([column]) => !omitKeys || !table.keyFields.includes(column))
    .map(([column, value]) => `${column}: ${literal(value, scalarOf(table, column))}`)
    .join(', ');
}

function keyArgs(table: FabricTable, row: Row): string {
  return table.keyFields
    .map((column) => `${column}: ${literal(row[column], scalarOf(table, column))}`)
    .join(', ');
}

export async function createRow(
  endpoint: string,
  table: FabricTable,
  values: Row,
  loginHint?: string
): Promise<void> {
  if (!table.createMutation) {
    throw missingOperation(table, 'insert');
  }
  const mutation = `mutation { ${table.createMutation}(item: { ${itemLiteral(table, values, false)} }) { ${table.createSelection ?? '__typename'} } }`;
  await execute(endpoint, mutation, undefined, loginHint);
}

export async function updateRow(
  endpoint: string,
  table: FabricTable,
  row: Row,
  changes: Row,
  loginHint?: string
): Promise<void> {
  if (!table.updateMutation) {
    throw missingOperation(table, 'update');
  }
  const mutation = `mutation { ${table.updateMutation}(${keyArgs(table, row)}, item: { ${itemLiteral(table, changes, true)} }) { ${table.updateSelection ?? '__typename'} } }`;
  await execute(endpoint, mutation, undefined, loginHint);
}

export async function deleteRow(
  endpoint: string,
  table: FabricTable,
  row: Row,
  loginHint?: string
): Promise<void> {
  if (!table.deleteMutation) {
    throw missingOperation(table, 'delete');
  }
  const mutation = `mutation { ${table.deleteMutation}(${keyArgs(table, row)}) { ${table.deleteSelection ?? '__typename'} } }`;
  await execute(endpoint, mutation, undefined, loginHint);
}
