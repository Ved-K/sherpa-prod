// src/lib/spLists.ts
const SITE_ID = import.meta.env.VITE_SP_SITE_ID as string;

export type GraphListItem<TFields> = {
  /** Graph list item id (string) */
  id: string;
  /** SharePoint fields payload */
  fields: TFields & { id?: number };
};

type ListQueryOpts = {
  filter?: string; // e.g. `fields/LineId eq 12`
  top?: number; // e.g. 500
  orderBy?: string; // e.g. `fields/Title`
  selectFields?: string[]; // reduces payload if you want
};

/**
 * Factory for a generic SharePoint list API.
 * Pass in your authenticated graphFetch from useGraph().
 */
export function makeSpListClient(
  graphFetch: <T = any>(path: string, init?: RequestInit) => Promise<T>,
) {
  async function listItems<TFields>(
    listId: string,
    opts?: ListQueryOpts,
  ): Promise<Array<GraphListItem<TFields>>> {
    const params = new URLSearchParams();
    params.set('$expand', 'fields');

    if (opts?.top) params.set('$top', String(opts.top));
    if (opts?.filter) params.set('$filter', opts.filter);
    if (opts?.orderBy) params.set('$orderby', opts.orderBy);

    // You can optionally reduce fields payload.
    // NOTE: fields selection is a bit awkward with Graph. This is optional.
    if (opts?.selectFields?.length) {
      // Example: $select=id,fields and $expand=fields($select=Title,LineId)
      params.set('$select', 'id,fields');
      params.set('$expand', `fields($select=${opts.selectFields.join(',')})`);
    }

    const data = await graphFetch<{ value: Array<GraphListItem<TFields>> }>(
      `/sites/${SITE_ID}/lists/${listId}/items?${params.toString()}`,
    );
    return data.value;
  }

  async function getItem<TFields>(
    listId: string,
    itemId: string,
  ): Promise<GraphListItem<TFields>> {
    return graphFetch(
      `/sites/${SITE_ID}/lists/${listId}/items/${itemId}?$expand=fields`,
    );
  }

  async function createItem<TFields extends Record<string, any>>(
    listId: string,
    fields: TFields,
  ) {
    return graphFetch(`/sites/${SITE_ID}/lists/${listId}/items`, {
      method: 'POST',
      body: JSON.stringify({ fields }),
    });
  }

  async function patchFields<TFields extends Record<string, any>>(
    listId: string,
    itemId: string,
    fields: TFields,
  ) {
    return graphFetch(
      `/sites/${SITE_ID}/lists/${listId}/items/${itemId}/fields`,
      {
        method: 'PATCH',
        body: JSON.stringify(fields),
      },
    );
  }

  async function deleteItem(listId: string, itemId: string) {
    return graphFetch(`/sites/${SITE_ID}/lists/${listId}/items/${itemId}`, {
      method: 'DELETE',
    });
  }

  return { listItems, getItem, createItem, patchFields, deleteItem };
}
