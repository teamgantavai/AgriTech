// ================================================================
// supabase.ts — Supabase Client & Strict RLS Isolated Citizen Store
// Handles real Supabase connection or local isolated multi-tenant simulation
// ================================================================

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { CitizenProfile, ProfileFieldVerification, UserDocument, ProfileAuditLog } from '../types/profile';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isRealSupabaseConfigured = Boolean(
  SUPABASE_URL &&
  SUPABASE_ANON_KEY &&
  !SUPABASE_URL.includes('your-project')
);

// Standard mock demo citizens for multi-user security testing (Section 33)
export const DEMO_CITIZENS = {
  userA: {
    id: 'a1111111-1111-4111-8111-111111111111',
    email: 'dilkhush.jha@example.com',
    name: 'Dilkhush Jha',
    role: 'citizen',
  },
  userB: {
    id: 'b2222222-2222-4222-8222-222222222222',
    email: 'sunita.sharma@example.com',
    name: 'Sunita Sharma',
    role: 'citizen',
  },
};

// ── In-Memory / LocalStorage Multi-Tenant Store with Strict RLS Simulation ──
class LocalIsolatedStore {
  private currentUserId: string = DEMO_CITIZENS.userA.id;
  private currentUserEmail: string = DEMO_CITIZENS.userA.email;
  private authListeners: ((event: string, session: any) => void)[] = [];

  constructor() {
    const savedUserId = sessionStorage.getItem('gram_auth_user_id');
    const savedUserEmail = sessionStorage.getItem('gram_auth_user_email');
    if (savedUserId) {
      this.currentUserId = savedUserId;
      this.currentUserEmail = savedUserEmail || 'citizen@example.com';
    } else {
      // Seed default User A on first visit
      this.seedInitialUserA();
    }
  }

  private seedInitialUserA() {
    const key = `gram_profile_${DEMO_CITIZENS.userA.id}`;
    if (!localStorage.getItem(key)) {
      const defaultProfile: CitizenProfile = {
        id: 'prof-user-a',
        user_id: DEMO_CITIZENS.userA.id,
        full_name: 'Dilkhush Jha',
        profile_photo_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
        date_of_birth: '2005-03-12',
        gender: 'male',
        mobile: '9876543210',
        email: 'dilkhush.jha@example.com',
        state: 'Punjab',
        district: 'Ludhiana',
        sub_district: 'Ludhiana West',
        village_city: 'Dugri',
        pin_code: '141013',
        address: 'House 42, Dugri Phase 2',
        highest_qualification: 'Graduate / B.Tech / B.Sc / BA',
        course: 'B.Tech Agricultural Engineering',
        institution: 'Punjab Agricultural University (PAU)',
        passing_year: 2026,
        occupation: 'Student',
        category: 'General',
        annual_family_income: 180000,
        is_farmer: false,
        farmer_land_details: null,
        farmer_crops: null,
        farmer_irrigation: null,
        farmer_type: null,
        profile_type: 'student',
        completion_percentage: 85,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      localStorage.setItem(key, JSON.stringify(defaultProfile));

      // Verifications for User A
      const verifs: ProfileFieldVerification[] = [
        { user_id: DEMO_CITIZENS.userA.id, field_name: 'full_name', value: 'Dilkhush Jha', source: 'voice', status: 'CONFIRMED', confidence: 0.98, confirmed_at: new Date().toISOString() },
        { user_id: DEMO_CITIZENS.userA.id, field_name: 'date_of_birth', value: '2005-03-12', source: 'voice', status: 'CONFIRMED', confidence: 0.95, confirmed_at: new Date().toISOString() },
        { user_id: DEMO_CITIZENS.userA.id, field_name: 'state', value: 'Punjab', source: 'voice', status: 'CONFIRMED', confidence: 0.99, confirmed_at: new Date().toISOString() },
        { user_id: DEMO_CITIZENS.userA.id, field_name: 'district', value: 'Ludhiana', source: 'voice', status: 'CONFIRMED', confidence: 0.97, confirmed_at: new Date().toISOString() },
      ];
      localStorage.setItem(`gram_verifs_${DEMO_CITIZENS.userA.id}`, JSON.stringify(verifs));
    }
  }

  getCurrentUser() {
    return {
      id: this.currentUserId,
      email: this.currentUserEmail,
      app_metadata: {},
      user_metadata: { name: this.currentUserId === DEMO_CITIZENS.userA.id ? DEMO_CITIZENS.userA.name : DEMO_CITIZENS.userB.name },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    };
  }

  switchUser(userId: string, email: string) {
    this.currentUserId = userId;
    this.currentUserEmail = email;
    sessionStorage.setItem('gram_auth_user_id', userId);
    sessionStorage.setItem('gram_auth_user_email', email);
    this.authListeners.forEach((cb) => cb('SIGNED_IN', { user: this.getCurrentUser() }));
  }

  signOut() {
    // Switch to new clean guest citizen
    const freshId = `guest-${Date.now()}`;
    this.switchUser(freshId, `guest_${freshId.slice(-4)}@gram.local`);
  }

  onAuthStateChange(callback: (event: string, session: any) => void) {
    this.authListeners.push(callback);
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            this.authListeners = this.authListeners.filter((l) => l !== callback);
          },
        },
      },
    };
  }

  // ── STRICT RLS-ENFORCED TABLE OPERATIONS ──
  // Rule: auth.uid() must match user_id. Cross-tenant access returns error or empty array!
  getProfile(targetUserId: string): CitizenProfile | null {
    if (targetUserId !== this.currentUserId) {
      console.warn(`[RLS VIOLATION PREVENTED] User ${this.currentUserId} attempted to view profile of User ${targetUserId}`);
      return null; // Strict isolation!
    }
    const raw = localStorage.getItem(`gram_profile_${targetUserId}`);
    return raw ? JSON.parse(raw) : null;
  }

  saveProfile(profile: CitizenProfile): boolean {
    if (profile.user_id !== this.currentUserId) {
      console.error(`[RLS VIOLATION] User ${this.currentUserId} cannot write profile for ${profile.user_id}`);
      return false;
    }
    profile.updated_at = new Date().toISOString();
    localStorage.setItem(`gram_profile_${profile.user_id}`, JSON.stringify(profile));
    return true;
  }

  getVerifications(targetUserId: string): ProfileFieldVerification[] {
    if (targetUserId !== this.currentUserId) {
      return [];
    }
    const raw = localStorage.getItem(`gram_verifs_${targetUserId}`);
    return raw ? JSON.parse(raw) : [];
  }

  saveVerification(verif: ProfileFieldVerification): boolean {
    if (verif.user_id !== this.currentUserId) return false;
    const current = this.getVerifications(verif.user_id);
    const filtered = current.filter((v) => v.field_name !== verif.field_name);
    filtered.push(verif);
    localStorage.setItem(`gram_verifs_${verif.user_id}`, JSON.stringify(filtered));
    return true;
  }

  getDocuments(targetUserId: string): UserDocument[] {
    if (targetUserId !== this.currentUserId) return [];
    const raw = localStorage.getItem(`gram_docs_${targetUserId}`);
    if (raw) return JSON.parse(raw);

    // Default sample documents vault for testing
    return [
      {
        id: 'doc-aadhaar',
        user_id: targetUserId,
        document_type: 'aadhaar',
        document_title: 'Aadhaar Card (UIDAI)',
        document_number_masked: 'XXXX-XXXX-8921',
        verification_status: 'user_confirmed',
        created_at: new Date().toISOString(),
      },
      {
        id: 'doc-income',
        user_id: targetUserId,
        document_type: 'income_certificate',
        document_title: 'Annual Income Certificate (Tehsildar)',
        document_number_masked: 'INC/2025/74189',
        issue_date: '2025-04-10',
        expiry_date: '2026-03-31',
        verification_status: 'user_confirmed',
        created_at: new Date().toISOString(),
      },
      {
        id: 'doc-residence',
        user_id: targetUserId,
        document_type: 'residence_certificate',
        document_title: 'Domicile / Residence Certificate',
        document_number_masked: 'DOM/PB/2024/9912',
        verification_status: 'user_confirmed',
        created_at: new Date().toISOString(),
      },
    ];
  }

  saveDocument(doc: UserDocument): boolean {
    if (doc.user_id !== this.currentUserId) return false;
    const current = this.getDocuments(doc.user_id);
    const filtered = current.filter((d) => d.id !== doc.id);
    filtered.unshift(doc);
    localStorage.setItem(`gram_docs_${doc.user_id}`, JSON.stringify(filtered));
    return true;
  }

  deleteDocument(targetUserId: string, docId: string): boolean {
    if (targetUserId !== this.currentUserId) return false;
    const current = this.getDocuments(targetUserId);
    const filtered = current.filter((d) => d.id !== docId);
    localStorage.setItem(`gram_docs_${targetUserId}`, JSON.stringify(filtered));
    return true;
  }

  saveAuditLog(log: Omit<ProfileAuditLog, 'id' | 'created_at'>) {
    if (log.user_id !== this.currentUserId) return;
    const key = `gram_audit_${log.user_id}`;
    const raw = localStorage.getItem(key);
    const logs: ProfileAuditLog[] = raw ? JSON.parse(raw) : [];
    logs.unshift({
      id: `audit-${Date.now()}`,
      ...log,
      created_at: new Date().toISOString(),
    });
    localStorage.setItem(key, JSON.stringify(logs.slice(0, 50)));
  }

  getAuditLogs(targetUserId: string): ProfileAuditLog[] {
    if (targetUserId !== this.currentUserId) return [];
    const raw = localStorage.getItem(`gram_audit_${targetUserId}`);
    return raw ? JSON.parse(raw) : [];
  }
}

export const localStore = new LocalIsolatedStore();

// Export real or mock client
export const supabase: SupabaseClient | any = isRealSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : {
      auth: {
        getUser: async () => ({ data: { user: localStore.getCurrentUser() }, error: null }),
        getSession: async () => ({ data: { session: { user: localStore.getCurrentUser() } }, error: null }),
        signOut: async () => {
          localStore.signOut();
          return { error: null };
        },
        onAuthStateChange: (cb: any) => localStore.onAuthStateChange(cb),
      },
      from: (table: string) => ({
        select: (_fields?: string) => ({
          eq: (col: string, val: any) => ({
            single: async () => {
              const user = localStore.getCurrentUser();
              if (col === 'user_id' && val !== user.id) {
                return { data: null, error: { message: 'RLS: permission denied for relation ' + table } };
              }
              const data = table === 'user_profiles' ? localStore.getProfile(val) : null;
              return { data, error: null };
            },
          }),
        }),
      }),
    };
