export type LegalReminderDto = {
  id: string;
  offsetValue: number;
  offsetUnit: "DAYS" | "MONTHS";
  sendOn: string;
  sentAt: string | null;
  lastError: string | null;
};

export type LegalDocumentDto = {
  id: string;
  type: string;
  typeLabel: string;
  otherTypeLabel: string | null;
  description: string;
  amount: number;
  dueDate: string;
  company: string | null;
  referenceNumber: string | null;
  notes: string | null;
  paid: boolean;
  paidAt: string | null;
  responsibleUserId: string;
  responsibleName: string;
  responsibleEmail: string;
  reminders: LegalReminderDto[];
};

export type LegalCalendarDay = {
  date: string;
  documents: LegalDocumentDto[];
  total: number;
  totalPaid: number;
};

export type LegalCalendarMonth = {
  month: string;
  days: LegalCalendarDay[];
  documents: LegalDocumentDto[];
  totals: { pending: number; paid: number; total: number };
};

export type LegalChangeLogDto = {
  id: string;
  legalDocumentId: string;
  documentDescription: string | null;
  documentCompany: string | null;
  field: string;
  fieldLabel: string;
  previousValue: string | null;
  newValue: string | null;
  changedByName: string | null;
  createdAt: string;
};

export type LegalAttachmentDto = {
  id: string;
  legalDocumentId: string;
  fileName: string;
  mimeType: string;
  note: string | null;
  createdAt: string;
  uploadedBy: { id: string; name: string };
  downloadUrl: string;
};

export type ResponsibleUserDto = {
  id: string;
  name: string;
  email: string;
};
