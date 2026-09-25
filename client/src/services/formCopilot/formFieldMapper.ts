// ================================================================
// FormFieldMapper — Maps Form Fields <-> Verified Profile & Documents
// Implements OCR document matching, confidence calculation, and conflict flags
// ================================================================

import type { CitizenProfile, UserDocument } from '../../types/profile';
import { getUserDocuments } from '../profileService';
import type {
  FormFieldDefinition,
  MappedFormField,
  MappingSource,
  MappingStatus,
  PortalFormSchema,
} from './types';
import { formDataResolver } from './formDataResolver';

export class FormFieldMapper {
  /**
   * Main mapping entrypoint:
   * Takes a government form schema + profile + verified documents
   * and produces fully mapped fields with status and source attribution.
   */
  async mapFormFields(
    schema: PortalFormSchema,
    profile?: CitizenProfile,
    customDocs?: UserDocument[]
  ): Promise<{
    mappedFields: MappedFormField[];
    readyCount: number;
    documentCount: number;
    needsInputCount: number;
  }> {
    const documents = customDocs || (await getUserDocuments());
    const resolvedProfileMap = await formDataResolver.resolveRequiredFields(schema.fields, profile);

    const mappedFields: MappedFormField[] = [];
    let readyCount = 0;
    let documentCount = 0;
    let needsInputCount = 0;

    for (const field of schema.fields) {
      const resolved = resolvedProfileMap.get(field.id);
      let source: MappingSource = 'manual';
      let value: any = null;
      let displayValue = '';
      let status: MappingStatus = 'missing';
      let confidence: 'high' | 'medium' | 'low' = 'low';
      let userConfirmed = false;
      let documentId: string | undefined;
      let documentTitle: string | undefined;
      let documentType: string | undefined;

      // 1. Check verified Profile
      if (resolved && resolved.value !== null && resolved.value !== undefined) {
        source = 'profile';
        value = resolved.value;
        displayValue = resolved.isSensitive && resolved.maskedDisplayValue ? resolved.maskedDisplayValue : resolved.displayValue;
        confidence = 'high';
        userConfirmed = resolved.isConfirmed;
        status = resolved.isConfirmed ? 'ready' : 'needs_confirmation';
      }

      // 2. Check Document Store if field is a file upload OR if income/education is missing
      if (field.type === 'file') {
        const matchedDoc = this.matchDocumentForFileField(field.id, documents);
        if (matchedDoc) {
          source = 'document';
          value = matchedDoc.id;
          displayValue = matchedDoc.document_title || matchedDoc.file_name || 'Document Attached';
          documentId = matchedDoc.id;
          documentTitle = matchedDoc.document_title;
          documentType = matchedDoc.document_type;
          confidence = 'high';
          userConfirmed = matchedDoc.verification_status === 'user_confirmed' || matchedDoc.verification_status === 'verified';
          status = 'ready';
        } else {
          status = field.required ? 'missing' : 'ready';
        }
      } else if (!value && (field.id === 'nsp_annual_income' || field.name.includes('income'))) {
        // Document OCR extraction fallback (Rule 9 & 10)
        const incomeDoc = documents.find((d) => d.document_type === 'income_certificate');
        if (incomeDoc && incomeDoc.extracted_data?.annual_income) {
          source = 'document';
          value = incomeDoc.extracted_data.annual_income;
          displayValue = `₹${Number(value).toLocaleString('en-IN')}`;
          documentId = incomeDoc.id;
          documentTitle = incomeDoc.document_title || 'Income Certificate';
          documentType = incomeDoc.document_type;
          confidence = 'medium';
          userConfirmed = false; // Never automatically trust OCR without user approval!
          status = 'needs_confirmation';
        }
      }

      // 3. Fallback for interactive questions (e.g. Day Scholar vs Hosteller, Ex-Serviceman)
      if (field.explanation && !value) {
        if (field.id === 'nsp_ward_ex_serviceman') {
          // Default sensible safe option with explanation
          value = 'no';
          displayValue = 'No / नहीं';
          source = 'user_input';
          status = 'ready';
          confidence = 'high';
          userConfirmed = true;
        } else if (field.id === 'nsp_day_scholar') {
          value = 'day_scholar';
          displayValue = 'Day Scholar / घर से';
          source = 'user_input';
          status = 'ready';
          confidence = 'high';
          userConfirmed = true;
        }
      }

      // 4. Update counters
      if (status === 'ready') {
        if (source === 'document') documentCount++;
        else readyCount++;
      } else {
        needsInputCount++;
      }

      mappedFields.push({
        fieldId: field.id,
        fieldLabel: field.label,
        fieldLabelHi: field.labelHi,
        stepNumber: field.stepNumber,
        section: field.section,
        required: field.required,
        type: field.type,
        options: field.options,
        source,
        sourceKey: resolved?.sourceKey,
        sourceLabel: source === 'profile' ? 'From your profile' : source === 'document' ? `From your ${documentTitle || 'Document'}` : 'Needs your input',
        value,
        displayValue: displayValue || (field.required ? 'Not filled' : 'Optional'),
        confidence,
        status,
        userConfirmed,
        documentId,
        documentTitle,
        documentType,
        isSensitive: field.isSensitive,
        maskedDisplayValue: resolved?.maskedDisplayValue,
        explanation: field.explanation,
      });
    }

    return { mappedFields, readyCount, documentCount, needsInputCount };
  }

  /**
   * Match required document type strictly (Rule 38)
   */
  private matchDocumentForFileField(fieldId: string, documents: UserDocument[]): UserDocument | null {
    if (fieldId === 'nsp_doc_income') {
      return documents.find((d) => d.document_type === 'income_certificate') || null;
    }
    if (fieldId === 'nsp_doc_caste') {
      return documents.find((d) => d.document_type === 'caste_certificate') || null;
    }
    if (fieldId === 'nsp_doc_marksheet') {
      return documents.find((d) => d.document_type === 'marksheet') || null;
    }
    if (fieldId === 'nsp_doc_residence') {
      return (
        documents.find(
          (d) => d.document_type === 'residence_certificate' || d.document_type === 'domicile_certificate'
        ) || null
      );
    }
    if (fieldId === 'pmk_doc_land') {
      return documents.find((d) => d.document_type === 'land_record') || null;
    }
    return null;
  }
}

export const formFieldMapper = new FormFieldMapper();
