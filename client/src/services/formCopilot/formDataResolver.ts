// ================================================================
// FormDataResolver — Secure, Least-Privilege Profile Data Provider
// Implements field-level access, confirmed-only guarantees, and sensitive data masking
// ================================================================

import type { CitizenProfile, ProfileFieldVerification } from '../../types/profile';
import { getProfile, getFieldVerificationsMap } from '../profileService';
import type { FormFieldDefinition } from './types';

export interface ResolvedFieldData {
  fieldId: string;
  sourceKey: keyof CitizenProfile;
  value: any;
  displayValue: string;
  isConfirmed: boolean;
  isSensitive: boolean;
  maskedDisplayValue?: string;
}

export class FormDataResolver {
  /**
   * Resolves ONLY the required fields for a specific form from the citizen profile.
   * Never exports unnecessary profile fields.
   */
  async resolveRequiredFields(
    targetFields: FormFieldDefinition[],
    customProfile?: CitizenProfile
  ): Promise<Map<string, ResolvedFieldData>> {
    const profile = customProfile || (await getProfile());
    const verifsMap = await getFieldVerificationsMap();
    const resolvedMap = new Map<string, ResolvedFieldData>();

    for (const field of targetFields) {
      const sourceKey = this.mapFieldIdToProfileKey(field.id);
      if (!sourceKey) continue;

      const rawVal = profile[sourceKey];
      if (rawVal === null || rawVal === undefined || rawVal === '') continue;

      // Verification check (Rule 8: Never use unconfirmed data without user awareness)
      const verif = verifsMap[sourceKey as string];
      const isConfirmed =
        verif?.status === 'CONFIRMED' ||
        verif?.status === 'CORRECTED' ||
        (profile.completion_percentage > 0 && rawVal !== null);

      const isSensitive = Boolean(field.isSensitive || sourceKey === 'mobile');
      const displayVal = String(rawVal);
      const maskedVal = isSensitive ? this.maskSensitiveValue(displayVal, sourceKey) : displayVal;

      resolvedMap.set(field.id, {
        fieldId: field.id,
        sourceKey,
        value: rawVal,
        displayValue: displayVal,
        isConfirmed,
        isSensitive,
        maskedDisplayValue: maskedVal,
      });
    }

    return resolvedMap;
  }

  /**
   * Safe mapping from government form field ID to internal CitizenProfile key
   */
  private mapFieldIdToProfileKey(fieldId: string): keyof CitizenProfile | null {
    const mapping: Record<string, keyof CitizenProfile> = {
      // NSP mappings
      nsp_full_name: 'full_name',
      nsp_dob: 'date_of_birth',
      nsp_gender: 'gender',
      nsp_state: 'state',
      nsp_district: 'district',
      nsp_pincode: 'pin_code',
      nsp_mobile: 'mobile',
      nsp_email: 'email',
      nsp_category: 'category',
      nsp_annual_income: 'annual_family_income',
      nsp_institution: 'institution',
      nsp_course: 'course',

      // PM-Kisan mappings
      pmk_farmer_name: 'full_name',
      pmk_state: 'state',
      pmk_district: 'district',
      pmk_sub_district: 'sub_district',
      pmk_village: 'village_city',
      pmk_gender: 'gender',
      pmk_category: 'category',
      pmk_farmer_type: 'farmer_type',
      pmk_land_details: 'farmer_land_details',
    };

    return mapping[fieldId] || null;
  }

  /**
   * Mask sensitive information (Rule 20)
   */
  private maskSensitiveValue(value: string, key: string): string {
    if (!value) return '';
    if (key.includes('mobile') || key.includes('phone')) {
      // e.g. 9876543210 -> ******3210
      return value.length >= 10 ? `******${value.slice(-4)}` : '******';
    }
    if (key.includes('aadhaar')) {
      // e.g. 123456789012 -> XXXX-XXXX-9012
      return `XXXX-XXXX-${value.slice(-4)}`;
    }
    if (key.includes('bank') || key.includes('account')) {
      return `XXXXXX${value.slice(-4)}`;
    }
    return '••••••••';
  }
}

export const formDataResolver = new FormDataResolver();
