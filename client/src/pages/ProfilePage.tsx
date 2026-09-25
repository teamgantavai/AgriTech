// ================================================================
// ProfilePage.tsx — Gram Sathi Citizen Profile System
// Complete once. Verified with AI. Reusable across government applications.
// Fully redesigned for citizen UX, 4-Card layout, zero technical jargon
// ================================================================

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAssistant } from '../context/AssistantContext';
import {
  getProfile,
  updateProfile,
  confirmProfileField,
  rejectProfileField,
  getFieldVerificationsMap,
  getUserDocuments,
  uploadUserDocument,
  deleteUserDocument,
  extractDocumentDataWithAi,
  applyDocumentExtractedData,
  getCurrentCitizenUser,
  switchCitizenAccount,
  getProfileForForm,
} from '../services/profileService';
import { calculateProfileCompletion } from '../data/profileFields';
import { DEMO_CITIZENS } from '../lib/supabase';
import { SUPPORTED_LANGUAGES } from '../services/sessionManager';
import type {
  CitizenProfile,
  FieldStatus,
  UserDocument,
  DocumentCategory,
  DocumentAiExtraction,
} from '../types/profile';
import {
  ShieldCheck,
  Sparkles,
  Mic,
  Edit2,
  CheckCircle2,
  AlertCircle,
  FileText,
  User,
  MapPin,
  GraduationCap,
  Tractor,
  Camera,
  Upload,
  Trash2,
  Plus,
  ArrowRight,
  X,
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  Globe,
} from 'lucide-react';
import { ProfileAiPreparationModal } from '../components/profile/ProfileAiPreparationModal';
import { DocumentAiExtractionModal } from '../components/profile/DocumentAiExtractionModal';
import {
  formatDateNicely,
  formatIncomeNicely,
  getFriendlyFieldLabel,
  formatFieldValueForCitizen,
} from '../services/profileInterviewController';

export function ProfilePage() {
  const { startProfileCollection, activeDetectedField, setLanguage, startVoice } = useAssistant();

  // Page language state ('en' | 'hi')
  const [pageLang, setPageLang] = useState<'en' | 'hi'>('en');

  // Citizen data states
  const [profile, setProfile] = useState<CitizenProfile | null>(null);
  const [verifications, setVerifications] = useState<Record<string, { status: FieldStatus; value?: any }>>({});
  const [documents, setDocuments] = useState<UserDocument[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Active expanded section for manual viewing & editing (Section 14)
  // 'all' | 'information' | 'address' | 'education' | 'documents' | 'farmer' | null
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [editableForm, setEditableForm] = useState<Partial<CitizenProfile>>({});
  const [isSaving, setIsSaving] = useState(false);

  // AI Preparation modal state (Section 1 & 29)
  const [isAiPrepModalOpen, setIsAiPrepModalOpen] = useState(false);

  // Document management & AI extraction states (Section 8, 9, 10, 11, 12)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [newDocCategory, setNewDocCategory] = useState<DocumentCategory>('income_certificate');
  const [newDocTitle, setNewDocTitle] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isExtracting, setIsExtracting] = useState<string | null>(null);
  const [activeExtraction, setActiveExtraction] = useState<DocumentAiExtraction | null>(null);
  const docFileInputRef = useRef<HTMLInputElement | null>(null);

  // Profile photo state
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [isPhotoPickerOpen, setIsPhotoPickerOpen] = useState(false);

  // Developer security test collapsible state (zero jargon in main UI)
  const [isDevSecurityOpen, setIsDevSecurityOpen] = useState(false);
  const [securityTestResult, setSecurityTestResult] = useState<any>(null);
  const [isTestingSecurity, setIsTestingSecurity] = useState(false);

  const PRESET_AVATARS = [
    { label: 'Citizen (Dilkhush)', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80' },
    { label: 'Student / Scholar', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80' },
    { label: 'Farmer / Kisan', url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80' },
    { label: 'Professional Citizen', url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&q=80' },
  ];

  // Load all citizen profile data
  const loadCitizenData = useCallback(async () => {
    setIsLoading(true);
    try {
      const user = await getCurrentCitizenUser();
      setCurrentUser(user);
      const prof = await getProfile();
      setProfile(prof);
      setEditableForm(prof);

      const verifs = await getFieldVerificationsMap();
      setVerifications(verifs);

      const docs = await getUserDocuments();
      setDocuments(docs);
    } catch (err) {
      console.error('Failed to load citizen profile data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCitizenData();
  }, [loadCitizenData]);

  // Language switcher helper
  const handleSetLanguage = (lang: 'en' | 'hi') => {
    setPageLang(lang);
    const langObj = SUPPORTED_LANGUAGES.find((l) => l.code === lang);
    if (langObj) setLanguage(langObj);
  };

  // Normalization helper for speech-to-field mapping and input format standardization
  const normalizeProfileFieldAndValue = (rawField: string, rawVal: any): { field: keyof CitizenProfile | null; value: any } => {
    if (!rawField) return { field: null, value: rawVal };
    const cleanField = rawField.toLowerCase().trim().replace(/[\s\-]/g, '_');

    const FIELD_ALIASES: Record<string, keyof CitizenProfile> = {
      name: 'full_name',
      fullname: 'full_name',
      full_name: 'full_name',
      citizen_name: 'full_name',
      dob: 'date_of_birth',
      date_of_birth: 'date_of_birth',
      birthdate: 'date_of_birth',
      birth_date: 'date_of_birth',
      gender: 'gender',
      sex: 'gender',
      mobile: 'mobile',
      phone: 'mobile',
      phonenumber: 'mobile',
      phone_number: 'mobile',
      mobile_number: 'mobile',
      email: 'email',
      email_address: 'email',
      state: 'state',
      district: 'district',
      city: 'village_city',
      village: 'village_city',
      village_city: 'village_city',
      town: 'village_city',
      pin: 'pin_code',
      pincode: 'pin_code',
      pin_code: 'pin_code',
      postal_code: 'pin_code',
      address: 'address',
      street_address: 'address',
      occupation: 'occupation',
      work: 'occupation',
      job: 'occupation',
      profession: 'occupation',
      qualification: 'highest_qualification',
      highest_qualification: 'highest_qualification',
      education: 'highest_qualification',
      degree: 'course',
      course: 'course',
      institution: 'institution',
      college: 'institution',
      school: 'institution',
      university: 'institution',
      category: 'category',
      social_category: 'category',
      caste: 'category',
      income: 'annual_family_income',
      annual_family_income: 'annual_family_income',
      annualincome: 'annual_family_income',
      family_income: 'annual_family_income',
    };

    const targetField = FIELD_ALIASES[cleanField] || (rawField as keyof CitizenProfile);
    let value = rawVal;

    if (targetField === 'gender' && typeof value === 'string') {
      const valLower = value.toLowerCase();
      if (valLower.includes('purush') || valLower.includes('पुरुष') || valLower.includes('male') || valLower.includes('mard') || valLower.includes('man') || valLower.includes('boy')) {
        value = 'male';
      } else if (valLower.includes('mahila') || valLower.includes('महिला') || valLower.includes('aurat') || valLower.includes('female') || valLower.includes('woman') || valLower.includes('girl')) {
        value = 'female';
      } else if (valLower.includes('other') || valLower.includes('अन्य')) {
        value = 'other';
      }
    } else if (targetField === 'annual_family_income') {
      if (typeof value === 'string') {
        const lakhMatch = value.match(/([\d.]+)\s*(?:lakh|लाख)/i);
        if (lakhMatch) {
          value = Math.round(parseFloat(lakhMatch[1]) * 100000);
        } else {
          const cleanDigits = value.replace(/[^0-9]/g, '');
          if (cleanDigits) value = parseInt(cleanDigits, 10);
        }
      }
    } else if (targetField === 'mobile' && typeof value === 'string') {
      value = value.replace(/[^0-9]/g, '').slice(-10);
    } else if (targetField === 'pin_code' && typeof value === 'string') {
      value = value.replace(/[^0-9]/g, '').slice(0, 6);
    } else if (targetField === 'category' && typeof value === 'string') {
      const valLower = value.toLowerCase();
      if (valLower.includes('general') || valLower.includes('सामान्य') || valLower.includes('gen')) value = 'General';
      else if (valLower.includes('obc') || valLower.includes('ओबीसी')) value = 'OBC';
      else if (valLower.includes('sc') || valLower.includes('अनुसूचित जाति')) value = 'SC';
      else if (valLower.includes('st') || valLower.includes('अनुसूचित जनजाति')) value = 'ST';
      else if (valLower.includes('ews') || valLower.includes('ईडब्ल्यूएस')) value = 'EWS';
    } else if (targetField === 'highest_qualification' && typeof value === 'string') {
      const valLower = value.toLowerCase();
      if (valLower.includes('10') || valLower.includes('दसवीं') || valLower.includes('matric')) value = '10th Pass';
      else if (valLower.includes('12') || valLower.includes('बारहवीं') || valLower.includes('inter')) value = '12th Pass';
      else if (valLower.includes('diploma') || valLower.includes('iti') || valLower.includes('आईटीआई')) value = 'Diploma / ITI';
      else if (valLower.includes('post') || valLower.includes('master') || valLower.includes('pg') || valLower.includes('स्नातकोत्तर')) value = 'Post Graduate';
      else if (valLower.includes('grad') || valLower.includes('bachelor') || valLower.includes('degree') || valLower.includes('ba') || valLower.includes('bsc') || valLower.includes('btech') || valLower.includes('स्नातक')) value = 'Graduate';
    } else if (targetField === 'date_of_birth' && typeof value === 'string') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
        value = value.trim();
      } else {
        const dmy = value.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
        if (dmy) {
          const d = dmy[1].padStart(2, '0');
          const m = dmy[2].padStart(2, '0');
          const y = dmy[3];
          value = `${y}-${m}-${d}`;
        } else {
          const parsed = new Date(value);
          if (!isNaN(parsed.getTime())) {
            value = parsed.toISOString().split('T')[0];
          }
        }
      }
    }

    return { field: targetField, value };
  };

  // Real-time listener for voice assistant field extractions and confirmations
  useEffect(() => {
    const handleVoiceToolEvent = (e: Event) => {
      const { tool, args } = (e as CustomEvent).detail || {};
      if (tool === 'profile_extract_field' || tool === 'profile_confirm_field' || tool === 'fillField') {
        const rawField = String(args.fieldName || args.fieldId || '');
        const { field: fieldName, value: val } = normalizeProfileFieldAndValue(rawField, args.value);

        if (fieldName && val !== undefined) {
          // Immediately update profile and form input state in real-time
          setProfile((prev) => (prev ? { ...prev, [fieldName]: val } : prev));
          setEditableForm((prev) => ({ ...prev, [fieldName]: val }));

          // Determine relevant category and auto-expand that section
          const infoKeys = ['full_name', 'date_of_birth', 'gender', 'mobile', 'category', 'annual_family_income', 'email'];
          const addressKeys = ['state', 'district', 'village_city', 'pin_code', 'address'];
          const eduKeys = ['highest_qualification', 'occupation', 'course', 'institution'];

          let targetSec = 'information';
          if (addressKeys.includes(fieldName as string)) targetSec = 'address';
          else if (eduKeys.includes(fieldName as string)) targetSec = 'education';

          setExpandedSection(targetSec);
          setTimeout(() => {
            scrollToSection(`section-${targetSec}`);
          }, 80);

          const friendly = getFriendlyFieldLabel(fieldName as string, pageLang);
          setSaveSuccessMsg(`✓ ${friendly}: ${formatFieldValueForCitizen(fieldName as string, val)}`);
          setTimeout(() => setSaveSuccessMsg(null), 3500);
        }
      }
    };

    window.addEventListener('voice:tool', handleVoiceToolEvent);
    return () => window.removeEventListener('voice:tool', handleVoiceToolEvent);
  }, [pageLang]);

  // Recalculate completion statistics (Section 14)
  const completionStats = useMemo(() => {
    if (!profile) {
      return { percentage: 0, completedFields: 0, totalFields: 0, missingFields: [], completedList: [] };
    }
    return calculateProfileCompletion(profile, verifications);
  }, [profile, verifications]);

  // Category completion helpers
  const getSectionStats = (fields: (keyof CitizenProfile)[]) => {
    if (!profile) return { completed: 0, total: fields.length, percentage: 0 };
    let completed = 0;
    for (const f of fields) {
      const val = profile[f];
      if (val !== null && val !== undefined && String(val).trim() !== '') {
        completed++;
      }
    }
    return {
      completed,
      total: fields.length,
      percentage: Math.round((completed / fields.length) * 100),
    };
  };

  const infoStats = useMemo(
    () => getSectionStats(['full_name', 'date_of_birth', 'gender', 'mobile', 'category', 'annual_family_income']),
    [profile]
  );
  const addressStats = useMemo(
    () => getSectionStats(['state', 'district', 'village_city', 'pin_code', 'address']),
    [profile]
  );
  const educationStats = useMemo(
    () => getSectionStats(['highest_qualification', 'occupation', 'course', 'institution']),
    [profile]
  );

  // Switch citizen accounts for Section 33 security verification
  const handleSwitchCitizen = async (userKey: 'userA' | 'userB') => {
    const target = DEMO_CITIZENS[userKey];
    switchCitizenAccount(target.id, target.email);
    setSaveSuccessMsg(`Switched to ${target.name}`);
    setTimeout(() => setSaveSuccessMsg(null), 3000);
    await loadCitizenData();
  };

  // Rock-solid smooth scroll helper for the app shell main container
  const scrollToSection = (sectionId: string) => {
    const tryScroll = (attempts = 4) => {
      const el = document.getElementById(sectionId);
      const main = document.querySelector('main');
      if (el && main) {
        const mainRect = main.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const targetScrollTop = main.scrollTop + (elRect.top - mainRect.top) - 20;
        main.scrollTo({
          top: Math.max(0, targetScrollTop),
          behavior: 'smooth',
        });
      } else if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (attempts > 0) {
        setTimeout(() => tryScroll(attempts - 1), 60);
      }
    };
    requestAnimationFrame(() => tryScroll());
  };

  // Toggle drawer open/close with reliable smooth scrolling
  const handleToggleSection = (section: string) => {
    if (expandedSection === section) {
      setExpandedSection(null);
    } else {
      setExpandedSection(section);
      setTimeout(() => {
        scrollToSection(`section-${section}`);
      }, 70);
    }
  };

  // Explicitly ensure drawer is open and smoothly scroll down to form
  const handleOpenAndScrollToSection = (section: string) => {
    if (expandedSection === section) {
      scrollToSection(`section-${section}`);
    } else {
      setExpandedSection(section);
      setTimeout(() => {
        scrollToSection(`section-${section}`);
      }, 70);
    }
  };

  // Run automated multi-citizen isolation test
  const handleRunSecurityTest = async () => {
    setIsTestingSecurity(true);
    try {
      const resp = await fetch('/api/profile/security-test');
      const data = await resp.json();
      setSecurityTestResult(data);
    } catch (err: any) {
      setSecurityTestResult({ status: 'error', error: err.message });
    } finally {
      setIsTestingSecurity(false);
    }
  };

  // Manual save handler (Section 22: Optimistic UI)
  const handleManualSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editableForm || isSaving) return;

    setIsSaving(true);
    // Optimistic local update
    const previous = profile;
    setProfile((prev) => (prev ? { ...prev, ...editableForm } : prev));

    try {
      const updated = await updateProfile(editableForm, 'manual');
      setProfile(updated);
      const verifs = await getFieldVerificationsMap();
      setVerifications(verifs);
      setSaveSuccessMsg('✓ Profile details saved successfully');
      setTimeout(() => setSaveSuccessMsg(null), 3500);
    } catch (err) {
      console.error('Error saving profile:', err);
      setProfile(previous);
      setSaveSuccessMsg("Couldn't save changes. Please try again.");
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } finally {
      setIsSaving(false);
    }
  };

  // Photo upload handler
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 4 * 1024 * 1024) {
      alert('Photo size exceeds 4MB. Please choose a smaller photo.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Url = reader.result as string;
      const updated = await updateProfile({ profile_photo_url: base64Url }, 'user_upload');
      setProfile(updated);
      setSaveSuccessMsg('✓ Profile photo updated');
      setTimeout(() => setSaveSuccessMsg(null), 3000);
      setIsPhotoPickerOpen(false);
    };
    reader.readAsDataURL(file);
  };

  // Select preset avatar
  const handleSelectPresetAvatar = async (url: string) => {
    const updated = await updateProfile({ profile_photo_url: url }, 'preset_avatar');
    setProfile(updated);
    setSaveSuccessMsg('✓ Profile photo updated');
    setTimeout(() => setSaveSuccessMsg(null), 3000);
    setIsPhotoPickerOpen(false);
  };

  // Document upload handler (Section 8, 9, 13)
  const handleUploadDocumentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      const categoryTitles: Record<DocumentCategory, string> = {
        aadhaar: 'Aadhaar Card',
        pan: 'PAN Card',
        income_certificate: 'Income Certificate',
        caste_certificate: 'Caste Certificate',
        residence_certificate: 'Residence Certificate',
        domicile_certificate: 'Domicile Certificate',
        marksheet: 'Marksheet / Degree',
        disability_certificate: 'Disability Certificate',
        land_record: 'Land Record (Jamabandi)',
        bank_document: 'Bank Passbook',
        other: 'Other Document',
      };

      const docTitle = newDocTitle.trim() || categoryTitles[newDocCategory] || selectedFile.name;
      const doc = await uploadUserDocument(selectedFile, newDocCategory, docTitle);

      setDocuments((prev) => [doc, ...prev]);
      setIsUploadModalOpen(false);
      setSelectedFile(null);
      setNewDocTitle('');
      setSaveSuccessMsg(`✓ ${docTitle} uploaded successfully`);
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    } catch (err) {
      console.error('Document upload failed:', err);
      alert('Failed to upload document. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  // Delete document handler
  const handleDeleteDocument = async (docId: string, title: string) => {
    if (!confirm(`Are you sure you want to remove "${title}" from your documents?`)) {
      return;
    }
    try {
      await deleteUserDocument(docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      setSaveSuccessMsg(`✓ ${title} removed`);
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    } catch (err) {
      console.error('Failed to remove document:', err);
    }
  };

  // AI Document Reading handler (Section 10, 11, 12)
  const handleReadDocumentWithAi = async (doc: UserDocument) => {
    if (!profile) return;
    setIsExtracting(doc.id);
    try {
      const extraction = await extractDocumentDataWithAi(doc, profile);
      setActiveExtraction(extraction);
    } catch (err) {
      console.error('AI document extraction error:', err);
      alert('Could not read document. Please check the file and try again.');
    } finally {
      setIsExtracting(null);
    }
  };

  // Apply extracted document data to profile
  const handleApplyExtractedData = async (fieldsToApply: Record<string, any>) => {
    if (!activeExtraction) return;
    try {
      const updated = await applyDocumentExtractedData(
        activeExtraction.documentTitle,
        activeExtraction.documentType,
        fieldsToApply
      );
      setProfile(updated);
      setEditableForm(updated);
      const verifs = await getFieldVerificationsMap();
      setVerifications(verifs);
      setSaveSuccessMsg(`✓ Saved details from your ${activeExtraction.documentTitle}`);
      setTimeout(() => setSaveSuccessMsg(null), 3500);
    } catch (err) {
      console.error('Failed to apply document data:', err);
    }
  };

  // Start AI Voice Interview (Section 1, 2, 16)
  const handleStartVoiceInterview = () => {
    setIsAiPrepModalOpen(false);
    startProfileCollection(profile || {});
  };

  if (isLoading && !profile) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm font-semibold text-slate-600">Loading your Gram Sathi Profile...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-24 font-sans">
      {/* ── Official Citizen Profile Header (Clean, Light & Professional) ── */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-xs mb-6">
        {/* Top Badges, Language Switcher and Citizen Switcher Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200/70">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>{pageLang === 'hi' ? 'आधिकारिक नागरिक प्रोफ़ाइल • डिजिटल इंडिया' : 'Official Citizen Profile • Digital India'}</span>
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Hindi / English Language Switcher */}
            <div className="flex items-center bg-slate-100/90 p-1 rounded-2xl border border-slate-200/70">
              <span className="text-[11px] font-semibold text-slate-400 px-2 flex items-center gap-1">
                <Globe className="w-3 h-3 text-slate-400" />
                <span>{pageLang === 'hi' ? 'भाषा:' : 'Language:'}</span>
              </span>
              <button
                type="button"
                onClick={() => handleSetLanguage('en')}
                className={`text-xs px-2.5 py-1 rounded-xl font-bold transition-all cursor-pointer ${
                  pageLang === 'en'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => handleSetLanguage('hi')}
                className={`text-xs px-2.5 py-1 rounded-xl font-bold transition-all cursor-pointer ${
                  pageLang === 'hi'
                    ? 'bg-white text-emerald-700 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                हिन्दी
              </button>
            </div>

            {/* Quick Demo Citizen Switcher */}
            <div className="flex items-center gap-1.5 bg-slate-100/90 p-1 rounded-2xl border border-slate-200/70 self-start sm:self-auto">
              <span className="text-[11px] font-semibold text-slate-400 px-2 hidden sm:inline">
                Citizen:
              </span>
              <button
                type="button"
                onClick={() => handleSwitchCitizen('userA')}
                className={`text-xs px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  currentUser?.id === DEMO_CITIZENS.userA.id
                    ? 'bg-white text-emerald-700 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Dilkhush (User A)
              </button>
              <button
                type="button"
                onClick={() => handleSwitchCitizen('userB')}
                className={`text-xs px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  currentUser?.id === DEMO_CITIZENS.userB.id
                    ? 'bg-white text-emerald-700 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sunita (User B)
              </button>
            </div>
          </div>
        </div>

        {/* Citizen Profile Hero Row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          <div className="flex items-start sm:items-center gap-4">
            {/* Avatar with Camera Trigger */}
            <div
              className="relative group cursor-pointer flex-shrink-0"
              onClick={() => setIsPhotoPickerOpen(true)}
              title="Click to change profile photo"
            >
              {profile?.profile_photo_url ? (
                <img
                  src={profile.profile_photo_url}
                  alt={profile.full_name || 'Citizen'}
                  className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl object-cover border-2 border-emerald-500 shadow-xs group-hover:brightness-95 transition-all"
                />
              ) : (
                <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center text-2xl font-black border-2 border-emerald-400 shadow-xs">
                  {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : '👤'}
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-600 group-hover:bg-emerald-700 text-white flex items-center justify-center shadow-xs border-2 border-white transition-all">
                <Camera className="w-3 h-3" />
              </div>
            </div>

            {/* Name, Contact & Badges */}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 truncate">
                  {profile?.full_name || currentUser?.name || 'Citizen User'}
                </h1>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{pageLang === 'hi' ? 'सत्यापित नागरिक' : 'Verified Citizen'}</span>
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mb-2.5">
                <span>{profile?.email || currentUser?.email || 'citizen@example.com'}</span>
                {profile?.mobile && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span>+91 {profile.mobile}</span>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setIsPhotoPickerOpen(true)}
                  className="text-emerald-600 hover:text-emerald-700 font-semibold cursor-pointer hover:underline"
                >
                  {pageLang === 'hi' ? 'फ़ोटो बदलें' : 'Change Photo'}
                </button>
              </div>

              {/* Citizen Attribute Line (Professional, sleek, clean typography - zero tacky emojis) */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-600">
                <div className="flex items-center gap-1.5 font-medium text-slate-700">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{profile?.district ? `${profile.district}, ${profile.state || 'India'}` : (profile?.state || 'India')}</span>
                </div>
                <span className="text-slate-300">•</span>
                <div className="flex items-center gap-1.5 font-medium text-slate-700">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span className="capitalize">{profile?.occupation || (pageLang === 'hi' ? 'नागरिक' : 'Citizen')}</span>
                </div>
                <span className="text-slate-300">•</span>
                <div className="flex items-center gap-1.5 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200/60">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{completionStats.completedFields} / {completionStats.totalFields} {pageLang === 'hi' ? 'विवरण पूर्ण' : 'details completed'} ({completionStats.percentage}%)</span>
                </div>
                <span className="text-slate-300">•</span>
                <div className="flex items-center gap-1.5 font-medium text-slate-700">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <span>{documents.length} {pageLang === 'hi' ? 'दस्तावेज़' : (documents.length === 1 ? 'document' : 'documents')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Floating Notification Toast (Visible from anywhere on the page) ── */}
      {saveSuccessMsg && (
        <div className="fixed top-4 right-4 left-4 sm:left-auto sm:right-6 sm:top-6 z-50 sm:max-w-md p-4 rounded-2xl bg-slate-900/95 backdrop-blur-md text-white border border-emerald-500/40 shadow-2xl flex items-center justify-between gap-3 animate-in slide-in-from-top-4 fade-in duration-200">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
              <Check className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-white">{pageLang === 'hi' ? 'विवरण सुरक्षित हो गया' : 'Details Saved'}</p>
              <p className="text-[11px] text-emerald-300 truncate mt-0.5">{saveSuccessMsg}</p>
            </div>
          </div>
          <button
            onClick={() => setSaveSuccessMsg(null)}
            className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Clean Voice Profile Assistant Section ── */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-sm mb-8 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
            <Mic className="w-4 h-4 text-emerald-600" />
            <span>{pageLang === 'hi' ? 'आवाज़ सहायक से प्रोफ़ाइल भरें' : 'Voice Assisted Profile Completion'}</span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {pageLang === 'hi'
              ? 'हिंदी या अंग्रेज़ी में बोलकर आसानी से अपनी प्रोफ़ाइल पूरी करें। विवरण सीधे फॉर्म में सुरक्षित हो जाएंगे।'
              : 'Complete your profile easily by speaking in Hindi or English. Answers are filled into the form in real-time.'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <button
            type="button"
            onClick={() => handleOpenAndScrollToSection('information')}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs sm:text-sm transition-all cursor-pointer"
          >
            <Edit2 className="w-4 h-4 text-slate-500" />
            <span>{pageLang === 'hi' ? 'मैन्युअल भरें' : 'Fill manually'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              const langObj = SUPPORTED_LANGUAGES.find((l) => l.code === pageLang);
              if (langObj) setLanguage(langObj);
              startVoice({ defaultMode: 'expanded', profileMode: true });
            }}
            className="flex items-center justify-center gap-2.5 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-lg shadow-emerald-600/25 transition-all cursor-pointer"
          >
            <Mic className="w-4 h-4" />
            <span>{pageLang === 'hi' ? 'आवाज़ शुरू करें' : 'Complete with Voice'}</span>
          </button>
        </div>
      </div>

      {/* ── The Four Cards Grid (Section 14) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
        {/* Card 1: My Information */}
        <div
          className={`bg-white rounded-3xl p-6 border transition-all flex flex-col justify-between ${
            expandedSection === 'information'
              ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-md'
              : 'border-slate-200/90 shadow-xs hover:shadow-md'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-lg">
                <User className="w-5 h-5 text-emerald-600" />
              </div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                {infoStats.percentage}% {pageLang === 'hi' ? 'पूर्ण' : 'complete'}
              </span>
            </div>
            <h3 className="text-base font-extrabold text-slate-900 mb-1">
              {pageLang === 'hi' ? 'मेरी व्यक्तिगत जानकारी' : 'My Information'}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              {pageLang === 'hi'
                ? 'पूरा नाम, जन्म तिथि, लिंग, मोबाइल और सामाजिक वर्ग का विवरण।'
                : 'Personal details including full name, date of birth, gender, and social category.'}
            </p>

            {/* Quick summary snippets */}
            <div className="space-y-1.5 mb-5 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span className="text-slate-400">{pageLang === 'hi' ? 'नाम:' : 'Name:'}</span>
                <span className="font-semibold text-slate-800">{profile?.full_name || (pageLang === 'hi' ? 'भरा नहीं है' : 'Not filled')}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span className="text-slate-400">{pageLang === 'hi' ? 'जन्म तिथि:' : 'Date of birth:'}</span>
                <span className="font-semibold text-slate-800">
                  {profile?.date_of_birth ? formatDateNicely(profile.date_of_birth) : (pageLang === 'hi' ? 'भरा नहीं है' : 'Not filled')}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span className="text-slate-400">{pageLang === 'hi' ? 'लिंग:' : 'Gender:'}</span>
                <span className="font-semibold text-slate-800 capitalize">
                  {profile?.gender ? profile.gender.replace(/_/g, ' ') : (pageLang === 'hi' ? 'भरा नहीं है' : 'Not filled')}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleToggleSection('information')}
            className={`w-full py-2.5 sm:py-3 px-4 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              expandedSection === 'information'
                ? 'bg-emerald-600 text-white shadow-xs hover:bg-emerald-700'
                : 'border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 text-slate-700 hover:text-emerald-800'
            }`}
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>
              {pageLang === 'hi'
                ? expandedSection === 'information'
                  ? 'विवरण छिपाएं'
                  : 'देखें और संपादित करें'
                : expandedSection === 'information'
                ? 'Hide Details'
                : 'View & Edit'}
            </span>
          </button>
        </div>

        {/* Card 2: My Address */}
        <div
          className={`bg-white rounded-3xl p-6 border transition-all flex flex-col justify-between ${
            expandedSection === 'address'
              ? 'border-teal-500 ring-2 ring-teal-500/20 shadow-md'
              : 'border-slate-200/90 shadow-xs hover:shadow-md'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center text-lg">
                <MapPin className="w-5 h-5 text-teal-600" />
              </div>
              <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-100">
                {addressStats.percentage}% {pageLang === 'hi' ? 'पूर्ण' : 'complete'}
              </span>
            </div>
            <h3 className="text-base font-extrabold text-slate-900 mb-1">
              {pageLang === 'hi' ? 'मेरा पता' : 'My Address'}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              {pageLang === 'hi'
                ? 'राज्य, जिला, गांव या शहर, पिन कोड और स्थायी निवास पता।'
                : 'State, district, village or town, postal PIN code, and permanent residential address.'}
            </p>

            <div className="space-y-1.5 mb-5 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span className="text-slate-400">{pageLang === 'hi' ? 'राज्य:' : 'State:'}</span>
                <span className="font-semibold text-slate-800">{profile?.state || (pageLang === 'hi' ? 'भरा नहीं है' : 'Not filled')}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span className="text-slate-400">{pageLang === 'hi' ? 'ज़िला:' : 'District:'}</span>
                <span className="font-semibold text-slate-800">{profile?.district || (pageLang === 'hi' ? 'भरा नहीं है' : 'Not filled')}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span className="text-slate-400">{pageLang === 'hi' ? 'पिन कोड:' : 'PIN Code:'}</span>
                <span className="font-semibold text-slate-800">{profile?.pin_code || (pageLang === 'hi' ? 'भरा नहीं है' : 'Not filled')}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleToggleSection('address')}
            className={`w-full py-2.5 sm:py-3 px-4 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              expandedSection === 'address'
                ? 'bg-teal-600 text-white shadow-xs hover:bg-teal-700'
                : 'border border-slate-200 hover:border-teal-300 hover:bg-teal-50/50 text-slate-700 hover:text-teal-800'
            }`}
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>
              {pageLang === 'hi'
                ? expandedSection === 'address'
                  ? 'विवरण छिपाएं'
                  : 'देखें और संपादित करें'
                : expandedSection === 'address'
                ? 'Hide Details'
                : 'View & Edit'}
            </span>
          </button>
        </div>

        {/* Card 3: Education & Work */}
        <div
          className={`bg-white rounded-3xl p-6 border transition-all flex flex-col justify-between ${
            expandedSection === 'education'
              ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-md'
              : 'border-slate-200/90 shadow-xs hover:shadow-md'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center text-lg">
                <GraduationCap className="w-5 h-5 text-indigo-600" />
              </div>
              <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
                {educationStats.percentage}% {pageLang === 'hi' ? 'पूर्ण' : 'complete'}
              </span>
            </div>
            <h3 className="text-base font-extrabold text-slate-900 mb-1">
              {pageLang === 'hi' ? 'शिक्षा और कार्य' : 'Education & Work'}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              {pageLang === 'hi'
                ? 'आपकी उच्चतम योग्यता, पाठ्यक्रम, संस्थान और वर्तमान व्यवसाय।'
                : 'Your highest education qualification, field of study, school/college, and current occupation.'}
            </p>

            <div className="space-y-1.5 mb-5 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span className="text-slate-400">{pageLang === 'hi' ? 'योग्यता:' : 'Education:'}</span>
                <span className="font-semibold text-slate-800">{profile?.highest_qualification || (pageLang === 'hi' ? 'भरा नहीं है' : 'Not filled')}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span className="text-slate-400">{pageLang === 'hi' ? 'व्यवसाय:' : 'Occupation:'}</span>
                <span className="font-semibold text-slate-800">{profile?.occupation || (pageLang === 'hi' ? 'भरा नहीं है' : 'Not filled')}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span className="text-slate-400">{pageLang === 'hi' ? 'वार्षिक आय:' : 'Income:'}</span>
                <span className="font-semibold text-slate-800">
                  {profile?.annual_family_income ? formatIncomeNicely(profile.annual_family_income) : (pageLang === 'hi' ? 'भरा नहीं है' : 'Not filled')}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleToggleSection('education')}
            className={`w-full py-2.5 sm:py-3 px-4 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              expandedSection === 'education'
                ? 'bg-indigo-600 text-white shadow-xs hover:bg-indigo-700'
                : 'border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 text-slate-700 hover:text-indigo-800'
            }`}
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>
              {pageLang === 'hi'
                ? expandedSection === 'education'
                  ? 'विवरण छिपाएं'
                  : 'देखें और संपादित करें'
                : expandedSection === 'education'
                ? 'Hide Details'
                : 'View & Edit'}
            </span>
          </button>
        </div>

        {/* Card 4: My Documents (Section 8, 9) */}
        <div
          className={`bg-white rounded-3xl p-6 border transition-all flex flex-col justify-between ${
            expandedSection === 'documents'
              ? 'border-amber-500 ring-2 ring-amber-500/20 shadow-md'
              : 'border-slate-200/90 shadow-xs hover:shadow-md'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center text-lg">
                <FileText className="w-5 h-5 text-amber-600" />
              </div>
              <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-100">
                {documents.length} {pageLang === 'hi' ? 'दस्तावेज़ उपलब्ध' : (documents.length === 1 ? 'document' : 'documents uploaded')}
              </span>
            </div>
            <h3 className="text-base font-extrabold text-slate-900 mb-1">
              {pageLang === 'hi' ? 'मेरे दस्तावेज़' : 'My Documents'}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              {pageLang === 'hi'
                ? 'सुरक्षित रूप से अपलोड किए गए प्रमाण पत्र और पहचान पत्र।'
                : 'Securely stored certificates and IDs. Gram Sathi can read documents with AI to extract details.'}
            </p>

            <div className="space-y-1.5 mb-5 text-xs">
              {documents.length === 0 ? (
                <div className="text-slate-400 italic">{pageLang === 'hi' ? 'कोई दस्तावेज़ अपलोड नहीं है।' : 'No documents uploaded yet.'}</div>
              ) : (
                documents.slice(0, 3).map((d) => (
                  <div key={d.id} className="flex items-center justify-between text-slate-600">
                    <span className="truncate max-w-[180px] font-medium">{d.document_title}</span>
                    <span className="text-[11px] text-emerald-600 font-semibold">{pageLang === 'hi' ? '✓ अपलोड है' : '✓ Uploaded'}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleToggleSection('documents')}
            className={`w-full py-2.5 sm:py-3 px-4 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              expandedSection === 'documents'
                ? 'bg-amber-600 text-white shadow-xs hover:bg-amber-700'
                : 'border border-slate-200 hover:border-amber-300 hover:bg-amber-50/50 text-slate-700 hover:text-amber-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>
              {pageLang === 'hi'
                ? expandedSection === 'documents'
                  ? 'दस्तावेज़ छिपाएं'
                  : 'दस्तावेज़ देखें'
                : expandedSection === 'documents'
                ? 'Hide Documents'
                : 'View Documents'}
            </span>
          </button>
        </div>
      </div>

      {/* ── Expanded Section Details (View & Edit Drawers) ── */}
      {expandedSection === 'information' && (
        <section id="section-information" className="bg-white rounded-3xl p-5 sm:p-8 border border-slate-200/90 shadow-sm mb-8 animate-in fade-in">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <User className="w-5 h-5 text-emerald-600" />
              <span>{pageLang === 'hi' ? 'व्यक्तिगत विवरण' : 'Personal Details'}</span>
            </h3>
            <button
              onClick={() => setExpandedSection(null)}
              className="text-xs font-semibold text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              ✕ {pageLang === 'hi' ? 'बंद करें' : 'Close'}
            </button>
          </div>

          <form onSubmit={handleManualSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                {pageLang === 'hi' ? 'पूरा नाम (Full Name)' : 'Full Name'}
              </label>
              <input
                type="text"
                value={editableForm.full_name || ''}
                onChange={(e) => setEditableForm({ ...editableForm, full_name: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-base sm:text-sm focus:ring-2 focus:ring-emerald-400 outline-none"
                placeholder={pageLang === 'hi' ? 'उदा. दिलखुश झा' : 'e.g. Dilkhush Jha'}
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                {pageLang === 'hi' ? 'जन्म तिथि (Date of Birth)' : 'Date of Birth'}
              </label>
              <input
                type="date"
                value={editableForm.date_of_birth || ''}
                onChange={(e) => setEditableForm({ ...editableForm, date_of_birth: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-base sm:text-sm focus:ring-2 focus:ring-emerald-400 outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                {pageLang === 'hi' ? 'लिंग (Gender)' : 'Gender'}
              </label>
              <select
                value={editableForm.gender || ''}
                onChange={(e) => setEditableForm({ ...editableForm, gender: e.target.value as any })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-base sm:text-sm focus:ring-2 focus:ring-emerald-400 outline-none bg-white"
              >
                <option value="">{pageLang === 'hi' ? 'लिंग चुनें' : 'Select Gender'}</option>
                <option value="male">{pageLang === 'hi' ? 'पुरुष (Male)' : 'Male'}</option>
                <option value="female">{pageLang === 'hi' ? 'महिला (Female)' : 'Female'}</option>
                <option value="other">{pageLang === 'hi' ? 'अन्य (Other)' : 'Other'}</option>
                <option value="prefer_not_to_say">{pageLang === 'hi' ? 'बताना नहीं चाहते' : 'Prefer not to say'}</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                {pageLang === 'hi' ? 'मोबाइल नंबर (Mobile Number)' : 'Mobile Number'}
              </label>
              <input
                type="tel"
                value={editableForm.mobile || ''}
                onChange={(e) => setEditableForm({ ...editableForm, mobile: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-base sm:text-sm focus:ring-2 focus:ring-emerald-400 outline-none"
                placeholder={pageLang === 'hi' ? '10 अंकों का मोबाइल नंबर' : '10-digit mobile number'}
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                {pageLang === 'hi' ? 'ईमेल पता (Email Address)' : 'Email Address'}
              </label>
              <input
                type="email"
                value={editableForm.email || ''}
                onChange={(e) => setEditableForm({ ...editableForm, email: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-base sm:text-sm focus:ring-2 focus:ring-emerald-400 outline-none"
                placeholder="name@example.com"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                {pageLang === 'hi' ? 'सामाजिक वर्ग (Category)' : 'Social Category'}
              </label>
              <select
                value={editableForm.category || ''}
                onChange={(e) => setEditableForm({ ...editableForm, category: e.target.value as any })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-base sm:text-sm focus:ring-2 focus:ring-emerald-400 outline-none bg-white"
              >
                <option value="">{pageLang === 'hi' ? 'वर्ग चुनें' : 'Select Category'}</option>
                <option value="General">General</option>
                <option value="OBC">OBC</option>
                <option value="SC">SC</option>
                <option value="ST">ST</option>
                <option value="EWS">EWS</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                {pageLang === 'hi' ? 'वार्षिक पारिवारिक आय (₹)' : 'Annual Family Income (₹)'}
              </label>
              <input
                type="number"
                value={editableForm.annual_family_income || ''}
                onChange={(e) =>
                  setEditableForm({
                    ...editableForm,
                    annual_family_income: e.target.value ? parseInt(e.target.value, 10) : null,
                  })
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-base sm:text-sm focus:ring-2 focus:ring-emerald-400 outline-none"
                placeholder="e.g. 180000"
              />
            </div>

            <div className="sm:col-span-2 pt-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3">
              {saveSuccessMsg && (
                <span className="text-xs text-emerald-600 font-bold flex items-center justify-center sm:justify-start gap-1.5 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>{pageLang === 'hi' ? 'विवरण सुरक्षित हो गया!' : 'Details saved successfully!'}</span>
                </span>
              )}
              <button
                type="submit"
                disabled={isSaving}
                className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-75 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  {isSaving
                    ? pageLang === 'hi'
                      ? 'सुरक्षित हो रहा है...'
                      : 'Saving...'
                    : pageLang === 'hi'
                    ? 'विवरण सुरक्षित करें'
                    : 'Save Details'}
                </span>
              </button>
            </div>
          </form>
        </section>
      )}

      {expandedSection === 'address' && (
        <section id="section-address" className="bg-white rounded-3xl p-5 sm:p-8 border border-slate-200/90 shadow-sm mb-8 animate-in fade-in">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-teal-600" />
              <span>{pageLang === 'hi' ? 'पते का विवरण' : 'Address Details'}</span>
            </h3>
            <button
              onClick={() => setExpandedSection(null)}
              className="text-xs font-semibold text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              ✕ {pageLang === 'hi' ? 'बंद करें' : 'Close'}
            </button>
          </div>

          <form onSubmit={handleManualSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                {pageLang === 'hi' ? 'राज्य (State)' : 'State'}
              </label>
              <input
                type="text"
                value={editableForm.state || ''}
                onChange={(e) => setEditableForm({ ...editableForm, state: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-base sm:text-sm focus:ring-2 focus:ring-teal-400 outline-none"
                placeholder={pageLang === 'hi' ? 'उदा. पंजाब' : 'e.g. Punjab'}
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                {pageLang === 'hi' ? 'ज़िला (District)' : 'District'}
              </label>
              <input
                type="text"
                value={editableForm.district || ''}
                onChange={(e) => setEditableForm({ ...editableForm, district: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-base sm:text-sm focus:ring-2 focus:ring-teal-400 outline-none"
                placeholder={pageLang === 'hi' ? 'उदा. लुधियाना' : 'e.g. Ludhiana'}
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                {pageLang === 'hi' ? 'शहर या गाँव (City / Village)' : 'City or Village'}
              </label>
              <input
                type="text"
                value={editableForm.village_city || ''}
                onChange={(e) => setEditableForm({ ...editableForm, village_city: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-base sm:text-sm focus:ring-2 focus:ring-teal-400 outline-none"
                placeholder={pageLang === 'hi' ? 'उदा. खन्ना' : 'e.g. Khanna'}
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                {pageLang === 'hi' ? 'पिन कोड (PIN Code)' : 'PIN Code'}
              </label>
              <input
                type="text"
                value={editableForm.pin_code || ''}
                onChange={(e) => setEditableForm({ ...editableForm, pin_code: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-base sm:text-sm focus:ring-2 focus:ring-teal-400 outline-none"
                placeholder="6-digit PIN"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-slate-700 block mb-1">
                {pageLang === 'hi' ? 'पूरा पता (Street Address)' : 'Complete Street Address'}
              </label>
              <textarea
                rows={2}
                value={editableForm.address || ''}
                onChange={(e) => setEditableForm({ ...editableForm, address: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-base sm:text-sm focus:ring-2 focus:ring-teal-400 outline-none"
                placeholder={pageLang === 'hi' ? 'मकान नं. / गली / मोहल्ला' : 'House / Street / Locality'}
              />
            </div>

            <div className="sm:col-span-2 pt-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3">
              {saveSuccessMsg && (
                <span className="text-xs text-emerald-600 font-bold flex items-center justify-center sm:justify-start gap-1.5 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>{pageLang === 'hi' ? 'विवरण सुरक्षित हो गया!' : 'Details saved successfully!'}</span>
                </span>
              )}
              <button
                type="submit"
                disabled={isSaving}
                className="w-full sm:w-auto px-6 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-75 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  {isSaving
                    ? pageLang === 'hi'
                      ? 'सुरक्षित हो रहा है...'
                      : 'Saving...'
                    : pageLang === 'hi'
                    ? 'विवरण सुरक्षित करें'
                    : 'Save Details'}
                </span>
              </button>
            </div>
          </form>
        </section>
      )}

      {expandedSection === 'education' && (
        <section id="section-education" className="bg-white rounded-3xl p-5 sm:p-8 border border-slate-200/90 shadow-sm mb-8 animate-in fade-in">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-indigo-600" />
              <span>{pageLang === 'hi' ? 'शिक्षा और कार्य' : 'Education & Work'}</span>
            </h3>
            <button
              onClick={() => setExpandedSection(null)}
              className="text-xs font-semibold text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              ✕ {pageLang === 'hi' ? 'बंद करें' : 'Close'}
            </button>
          </div>

          <form onSubmit={handleManualSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                {pageLang === 'hi' ? 'उच्चतम योग्यता (Highest Qualification)' : 'Highest Qualification'}
              </label>
              <select
                value={editableForm.highest_qualification || ''}
                onChange={(e) => setEditableForm({ ...editableForm, highest_qualification: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-base sm:text-sm focus:ring-2 focus:ring-indigo-400 outline-none bg-white"
              >
                <option value="">{pageLang === 'hi' ? 'योग्यता चुनें' : 'Select Qualification'}</option>
                <option value="10th Pass">{pageLang === 'hi' ? '10वीं पास (10th Pass)' : '10th Pass'}</option>
                <option value="12th Pass">{pageLang === 'hi' ? '12वीं पास (12th Pass)' : '12th Pass'}</option>
                <option value="Diploma / ITI">{pageLang === 'hi' ? 'डिप्लोमा / आईटीआई' : 'Diploma / ITI'}</option>
                <option value="Graduate">{pageLang === 'hi' ? 'स्नातक (Graduate)' : 'Graduate'}</option>
                <option value="Post Graduate">{pageLang === 'hi' ? 'स्नातकोत्तर (Post Graduate)' : 'Post Graduate'}</option>
                <option value="Other">{pageLang === 'hi' ? 'अन्य (Other)' : 'Other'}</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                {pageLang === 'hi' ? 'व्यवसाय (Occupation)' : 'Occupation'}
              </label>
              <input
                type="text"
                value={editableForm.occupation || ''}
                onChange={(e) => setEditableForm({ ...editableForm, occupation: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-base sm:text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                placeholder={pageLang === 'hi' ? 'उदा. किसान, छात्र, शिक्षक' : 'e.g. Farmer, Student, Teacher'}
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                {pageLang === 'hi' ? 'पाठ्यक्रम / डिग्री (Course / Degree)' : 'Course / Degree'}
              </label>
              <input
                type="text"
                value={editableForm.course || ''}
                onChange={(e) => setEditableForm({ ...editableForm, course: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-base sm:text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                placeholder={pageLang === 'hi' ? 'उदा. बी.एससी. कृषि' : 'e.g. B.Sc. Agriculture'}
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                {pageLang === 'hi' ? 'संस्थान / विद्यालय (Institution)' : 'Institution'}
              </label>
              <input
                type="text"
                value={editableForm.institution || ''}
                onChange={(e) => setEditableForm({ ...editableForm, institution: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-base sm:text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                placeholder={pageLang === 'hi' ? 'स्कूल / कॉलेज / विश्वविद्यालय' : 'School / College / University'}
              />
            </div>

            <div className="sm:col-span-2 pt-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3">
              {saveSuccessMsg && (
                <span className="text-xs text-emerald-600 font-bold flex items-center justify-center sm:justify-start gap-1.5 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>{pageLang === 'hi' ? 'विवरण सुरक्षित हो गया!' : 'Details saved successfully!'}</span>
                </span>
              )}
              <button
                type="submit"
                disabled={isSaving}
                className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-75 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  {isSaving
                    ? pageLang === 'hi'
                      ? 'सुरक्षित हो रहा है...'
                      : 'Saving...'
                    : pageLang === 'hi'
                    ? 'विवरण सुरक्षित करें'
                    : 'Save Details'}
                </span>
              </button>
            </div>
          </form>
        </section>
      )}

      {/* ── Expanded Section: Documents Vault (Section 8, 9, 10, 11) ── */}
      {expandedSection === 'documents' && (
        <section id="section-documents" className="bg-white rounded-3xl p-5 sm:p-8 border border-slate-200/90 shadow-sm mb-8 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-100 gap-4 mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-600" />
                <span>My Documents</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Upload and view your certificates. You can also read them with Gram Sathi AI.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Upload Document</span>
              </button>
              <button
                onClick={() => setExpandedSection(null)}
                className="text-xs font-semibold text-slate-400 hover:text-slate-600 px-2 py-1 cursor-pointer"
              >
                ✕ Close
              </button>
            </div>
          </div>

          {/* Documents Grid */}
          {documents.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-slate-700 mb-1">No documents uploaded yet</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
                You can upload certificates like Income Certificate, Aadhaar, Caste Certificate, or Marksheet.
              </p>
              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Upload First Document
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="p-4 rounded-2xl border border-slate-200/90 bg-slate-50/50 hover:bg-white transition-all flex flex-col justify-between"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0 text-sm">
                        📄
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 leading-tight">
                          {doc.document_title}
                        </h4>
                        <span className="text-[11px] text-slate-400 block mt-0.5 capitalize">
                          {doc.document_type.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 flex-shrink-0">
                      ✓ Uploaded
                    </span>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <button
                      onClick={() => handleReadDocumentWithAi(doc)}
                      disabled={isExtracting === doc.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>{isExtracting === doc.id ? 'Reading...' : 'Read with AI'}</span>
                    </button>

                    <div className="flex items-center gap-1">
                      {doc.file_url && (
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 text-slate-600 hover:text-slate-900 font-semibold"
                        >
                          View
                        </a>
                      )}
                      <button
                        onClick={() => handleDeleteDocument(doc.id, doc.document_title)}
                        className="p-1 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                        title="Remove document"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Document Upload Modal (Section 9) ── */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 overflow-hidden">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Upload className="w-4 h-4 text-emerald-600" />
                <span>Upload a Document</span>
              </h3>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUploadDocumentSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Document Type</label>
                <select
                  value={newDocCategory}
                  onChange={(e) => setNewDocCategory(e.target.value as DocumentCategory)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-400 outline-none bg-white"
                >
                  <option value="income_certificate">Income Certificate</option>
                  <option value="aadhaar">Aadhaar Card</option>
                  <option value="pan">PAN Card</option>
                  <option value="caste_certificate">Caste Certificate</option>
                  <option value="residence_certificate">Residence Certificate</option>
                  <option value="domicile_certificate">Domicile Certificate</option>
                  <option value="marksheet">Marksheet / Degree</option>
                  <option value="land_record">Land Record (Jamabandi)</option>
                  <option value="bank_document">Bank Document</option>
                  <option value="disability_certificate">Disability Certificate</option>
                  <option value="other">Other Document</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Document Title <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={newDocTitle}
                  onChange={(e) => setNewDocTitle(e.target.value)}
                  placeholder="e.g. Punjab Income Certificate 2024"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-400 outline-none"
                />
              </div>

              {/* Upload Dropzone */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Select File</label>
                <div
                  onClick={() => docFileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 hover:border-emerald-400 rounded-2xl p-6 text-center cursor-pointer transition-all bg-slate-50/50 hover:bg-emerald-50/20"
                >
                  <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-800">
                    {selectedFile ? selectedFile.name : 'Upload from your device'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">PDF, JPG, or PNG (Max 5MB)</p>
                </div>
                <input
                  ref={docFileInputRef}
                  type="file"
                  accept=".pdf,image/png,image/jpeg"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setSelectedFile(f);
                  }}
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedFile || isUploading}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {isUploading ? 'Uploading...' : 'Upload Document'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── AI Preparation Screen Modal (Section 1 & 29) ── */}
      <ProfileAiPreparationModal
        isOpen={isAiPrepModalOpen}
        onClose={() => setIsAiPrepModalOpen(false)}
        onStartVoice={handleStartVoiceInterview}
        onUploadDocuments={() => setExpandedSection('documents')}
      />

      {/* ── AI Document Reader & Conflict Resolution Modal (Section 10, 11, 12) ── */}
      <DocumentAiExtractionModal
        extraction={activeExtraction}
        isOpen={Boolean(activeExtraction)}
        onClose={() => setActiveExtraction(null)}
        onApplyDetails={handleApplyExtractedData}
      />

      {/* ── Profile Photo Picker Modal ── */}
      {isPhotoPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-sm font-bold text-slate-900">Choose Profile Photo</h3>
              <button
                onClick={() => setIsPhotoPickerOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <button
              onClick={() => photoInputRef.current?.click()}
              className="w-full mb-4 flex items-center justify-center gap-2 py-3 px-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-xl border border-emerald-200 transition-colors cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>Upload from Device</span>
            </button>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoUpload}
            />

            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 text-center">
              Or pick an avatar
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              {PRESET_AVATARS.map((av, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectPresetAvatar(av.url)}
                  className="flex items-center gap-2 p-2 rounded-xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/50 transition-all text-left cursor-pointer"
                >
                  <img src={av.url} alt={av.label} className="w-8 h-8 rounded-lg object-cover" />
                  <span className="text-[11px] font-semibold text-slate-700 truncate">{av.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Discreet Developer Security Verification (Section 23, 33) ── */}
      <div className="mt-16 pt-6 border-t border-slate-200 text-center">
        <button
          onClick={() => setIsDevSecurityOpen(!isDevSecurityOpen)}
          className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 cursor-pointer inline-flex items-center gap-1"
        >
          <span>Multi-Citizen Privacy & Isolation Check</span>
          {isDevSecurityOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        {isDevSecurityOpen && (
          <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-left max-w-lg mx-auto text-xs text-slate-600">
            <p className="mb-2 font-medium">
              Verifies that User A and User B cannot access each other's profiles or documents.
            </p>
            <button
              onClick={handleRunSecurityTest}
              disabled={isTestingSecurity}
              className="px-3 py-1.5 bg-slate-800 text-white font-bold rounded-lg text-xs cursor-pointer disabled:opacity-50"
            >
              {isTestingSecurity ? 'Testing...' : 'Run Privacy Verification Test'}
            </button>
            {securityTestResult && (
              <pre className="mt-3 p-2 bg-slate-100 rounded-lg text-[10px] overflow-x-auto text-slate-800">
                {JSON.stringify(securityTestResult, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
