import { NextResponse } from 'next/server';
import { readDb, writeDb } from '@/lib/local-db';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: Request) {
  const body = await request.json();
  const { action, table, data, query } = body;
  const db = readDb();

  if (action === 'select') {
    let rows = db[table] || [];
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        rows = rows.filter((row: any) => row[key] === value);
      });
    }
    // Handle single result expectation if needed, but usually returns array
    return NextResponse.json({ data: rows, error: null });
  }

  if (action === 'insert') {
    const newRow = { id: uuidv4(), ...data };
    db[table].push(newRow);
    writeDb(db);
    return NextResponse.json({ data: [newRow], error: null });
  }

  if (action === 'upsert') {
    const conflictKey = query?.on_conflict || 'id';
    const existingIndex = db[table].findIndex((row: any) => row[conflictKey] === data[conflictKey]);
    
    if (existingIndex >= 0) {
      db[table][existingIndex] = { ...db[table][existingIndex], ...data };
    } else {
      db[table].push({ id: uuidv4(), ...data });
    }
    writeDb(db);
    return NextResponse.json({ data: null, error: null });
  }

  if (action === 'update') {
    let updated = false;
    db[table] = db[table].map((row: any) => {
      let match = true;
      if (query) {
        Object.entries(query).forEach(([key, value]) => {
          if (row[key] !== value) match = false;
        });
      }
      if (match) {
        updated = true;
        return { ...row, ...data };
      }
      return row;
    });
    
    if (updated) writeDb(db);
    return NextResponse.json({ data: null, error: null });
  }
  
  if (action === 'auth_signup') {
    const { email, password } = data;
    const existingUser = db.users.find((u: any) => u.email === email);
    if (existingUser) {
      return NextResponse.json({ data: { user: null, session: null }, error: { message: 'User already exists' } });
    }
    const newUser = { id: uuidv4(), email, password, created_at: new Date().toISOString() };
    db.users.push(newUser);
    
    // Auto-create profile
    db.profiles.push({ id: newUser.id, username: null, is_onboarded: false });
    
    writeDb(db);
    return NextResponse.json({ data: { user: newUser, session: { access_token: 'fake-token', user: newUser } }, error: null });
  }

  if (action === 'auth_signin') {
    const { email, password } = data;
    const user = db.users.find((u: any) => u.email === email && u.password === password);
    if (!user) {
      return NextResponse.json({ data: { user: null, session: null }, error: { message: 'Invalid credentials' } });
    }
    return NextResponse.json({ data: { user: user, session: { access_token: 'fake-token', user: user } }, error: null });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
