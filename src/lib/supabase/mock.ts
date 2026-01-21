export class MockSupabaseClient {
  auth: any;
  currentUser: any = null;
  
  constructor() {
    this.auth = {
      signUp: async ({ email, password }: any) => {
        return this._request('auth_signup', 'users', { email, password });
      },
      signInWithPassword: async ({ email, password }: any) => {
        const res = await this._request('auth_signin', 'users', { email, password });
        if (res.data?.session) {
          if (typeof window !== 'undefined') {
            localStorage.setItem('sb-user', JSON.stringify(res.data.user));
            document.cookie = `sb-mock-user=${encodeURIComponent(JSON.stringify(res.data.user))}; path=/; max-age=31536000`;
          }
        }
        return res;
      },
      getUser: async () => {
        if (this.currentUser) return { data: { user: this.currentUser }, error: null };

        if (typeof window !== 'undefined') {
          const user = localStorage.getItem('sb-user');
          return { data: { user: user ? JSON.parse(user) : null }, error: null };
        }
        return { data: { user: null }, error: null };
      },
      getSession: async () => {
         return { data: { session: { user: this.currentUser } }, error: null };
      }
    };
  }

  _setMockUser(user: any) {
    this.currentUser = user;
  }

  from(table: string) {
    return new QueryBuilder(table);
  }

  async _request(action: string, table: string, data: any = null, query: any = null) {
    const url = typeof window !== 'undefined' ? '/api/mock-supabase' : 'http://localhost:3000/api/mock-supabase';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, table, data, query })
    });
    return res.json();
  }
}

class QueryBuilder {
  table: string;
  query: any;

  constructor(table: string) {
    this.table = table;
    this.query = {};
  }

  select(columns: string = '*') {
    return this;
  }

  eq(column: string, value: any) {
    this.query[column] = value;
    return this;
  }
  
  order(column: string, { ascending }: any) {
    // TODO: Implement sorting in mock API if needed
    return this;
  }

  async single() {
    const res = await this._execute('select');
    if (res.data && res.data.length > 0) {
      return { data: res.data[0], error: null };
    }
    return { data: null, error: { message: 'Not found' } };
  }

  async upsert(data: any, options: any = {}) {
    this.query = { ...this.query, ...options };
    return this._execute('upsert', data);
  }
  
  async update(data: any) {
    return this._execute('update', data);
  }

  async execute() {
    return this._execute('select');
  }
  
  // Helper to trigger execution for promises
  then(resolve: any, reject: any) {
    return this.execute().then(resolve, reject);
  }

  async _execute(action: string, data: any = null) {
    const client = new MockSupabaseClient();
    return client._request(action, this.table, data, this.query);
  }
}
