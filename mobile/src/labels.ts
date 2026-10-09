import { Category, Status, Strategy } from './types';

export const CATEGORY_LABEL: Record<Category, string> = {
  financial: 'Financial', operational: 'Operational', it: 'IT', infosec: 'Information security', reputational: 'Reputational',
};
export const STRATEGY_LABEL: Record<Strategy, string> = { avoid: 'Avoid', mitigate: 'Mitigate', transfer: 'Transfer', accept: 'Accept' };
export const STATUS_LABEL: Record<Status, string> = {
  pending: 'Draft', approved: 'Approved', edited: 'Edited', rejected: 'Rejected', escalated: 'Escalated', resolved: 'Resolved',
};
/** Treatment is complete when the risk is resolved, under way once a human has approved or escalated it. */
export const treatmentStatus = (s: Status) =>
  s === 'resolved' ? 'OK' : s === 'approved' || s === 'edited' || s === 'escalated' ? 'In progress' : 'Incomplete';
export const riskNum = (id: string) => id.replace(/^\D+0*/, '') || id;
