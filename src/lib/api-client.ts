import type {
  LoyaltyPointLedgerResponse,
  PersonAccountCreateRequest,
  PersonAccountExistsResponse,
  PersonAccountGetResponse,
  PersonAccountPatchResponse,
  PersonAccountSearchRecord,
  PersonAccountUpdateRequest,
  SalesforceErrorResponse,
} from './api-types.ts';

const DEFAULT_BASE_URL =
  'https://monnalisa-mid-dev-api-gw-1lcvs0vu.ew.gateway.dev';

function getBaseUrl(): string {
  // Vitest injects import.meta.env even in node, so this works for both browser and tests
  if (import.meta.env?.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL as string;
  }
  // In browser, use /api prefix so requests are proxied (Vite dev server or Vercel rewrites)
  // avoiding CORS and not colliding with frontend routes like /customers/:email
  if (typeof window !== 'undefined') {
    return '/api';
  }
  // Node.js (e.g. integration tests) — call backend directly
  return DEFAULT_BASE_URL;
}

export class ApiError extends Error {
  status: number;
  body: SalesforceErrorResponse | unknown;

  constructor(status: number, body: SalesforceErrorResponse | unknown) {
    const msg =
      body && typeof body === 'object' && 'message' in body
        ? (body as SalesforceErrorResponse).message
        : `API request failed with status ${status}`;
    super(msg);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

async function request<T>(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${getBaseUrl()}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = { message: response.statusText };
    }
    throw new ApiError(response.status, body);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new ApiError(response.status, {
      message: `Expected JSON response but got ${contentType || 'unknown content type'}`,
    });
  }

  return response.json() as Promise<T>;
}

export const customerApi = {
  checkEmailExists(
    email: string,
    token: string,
  ): Promise<PersonAccountExistsResponse> {
    return request(
      `/customers/checkEmailExists?email=${encodeURIComponent(email)}`,
      token,
    );
  },

  checkPhoneExists(
    phone: string,
    token: string,
  ): Promise<PersonAccountExistsResponse> {
    return request(
      `/customers/checkPhoneExists?phone=${encodeURIComponent(phone)}`,
      token,
    );
  },

  getAccount(
    email: string,
    token: string,
    fields?: string,
  ): Promise<PersonAccountGetResponse> {
    const params = new URLSearchParams({ email });
    if (fields) params.set('fields', fields);
    return request(`/customers/getAccount?${params.toString()}`, token);
  },

  createAccount(
    data: PersonAccountCreateRequest,
    token: string,
  ): Promise<PersonAccountPatchResponse> {
    return request('/customers/createAccount', token, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateAccount(
    email: string,
    data: PersonAccountUpdateRequest,
    token: string,
  ): Promise<PersonAccountPatchResponse> {
    return request(
      `/customers/updateAccount?email=${encodeURIComponent(email)}`,
      token,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      },
    );
  },

  getLoyaltyLedger(
    email: string,
    token: string,
    limit?: number,
  ): Promise<LoyaltyPointLedgerResponse> {
    const params = new URLSearchParams({ email });
    if (limit !== undefined) params.set('limit', String(limit));
    return request(`/customers/getLoyaltyLedger?${params.toString()}`, token);
  },

  search(
    query: string,
    token: string,
    limit?: number,
  ): Promise<PersonAccountSearchRecord[]> {
    const params = new URLSearchParams({ q: query });
    if (limit !== undefined) params.set('limit', String(limit));
    return request(`/customers/search?${params.toString()}`, token);
  },
};
