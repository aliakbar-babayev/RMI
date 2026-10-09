import { Category } from './types';

/** Common risk scenarios a team can add to its register. "Add" sends the text to the AI for assessment. */
export const LIBRARY: { id: string; category: Category; text: string }[] = [
  { id: 'L-01', category: 'financial', text: 'The project budget is exceeded because the plan has little or no contingency reserve.' },
  { id: 'L-02', category: 'financial', text: 'Costs rise unexpectedly because a key vendor increases prices during the contract term.' },
  { id: 'L-03', category: 'financial', text: 'Payments in foreign currency become more expensive due to exchange rate changes.' },
  { id: 'L-04', category: 'financial', text: 'Company funds are misused because payments are not approved by a second person.' },
  { id: 'L-05', category: 'financial', text: 'The company pays penalties because contractual delivery dates are missed.' },
  { id: 'L-06', category: 'operational', text: 'Work stops because only one person knows a critical system or process.' },
  { id: 'L-07', category: 'operational', text: 'The schedule slips because a vendor delivers a required component late.' },
  { id: 'L-08', category: 'operational', text: 'A go-live fails because there is no tested rollback plan for the cutover.' },
  { id: 'L-09', category: 'operational', text: 'Users cannot work with the new system because staff training was not planned.' },
  { id: 'L-10', category: 'operational', text: 'Delivery is delayed because the project scope keeps growing without change control.' },
  { id: 'L-11', category: 'it', text: 'Systems become unavailable because capacity is not planned for peak load.' },
  { id: 'L-12', category: 'it', text: 'Software stops working after an operating system or platform upgrade.' },
  { id: 'L-13', category: 'it', text: 'Data cannot be restored after an incident because backups are never tested.' },
  { id: 'L-14', category: 'it', text: 'Records are lost or corrupted during data migration because reconciliation is not done.' },
  { id: 'L-15', category: 'it', text: 'A single server or network link failure takes down a critical service.' },
  { id: 'L-16', category: 'infosec', text: 'Systems are compromised because administrator passwords are shared between staff.' },
  { id: 'L-17', category: 'infosec', text: 'An employee account is taken over through a phishing email.' },
  { id: 'L-18', category: 'infosec', text: 'Company data is exposed in transit because encryption is not used.' },
  { id: 'L-19', category: 'infosec', text: 'Real customer data leaks because it is copied into test environments.' },
  { id: 'L-20', category: 'infosec', text: 'Attackers enter through an unpatched vulnerability in a non-production system.' },
  { id: 'L-21', category: 'reputational', text: 'Customers complain publicly because the service has frequent outages.' },
  { id: 'L-22', category: 'reputational', text: 'Staff share incident details with the media without approval from communications.' },
  { id: 'L-23', category: 'reputational', text: 'Trust is damaged because the public privacy policy is inaccurate or incomplete.' },
  { id: 'L-24', category: 'reputational', text: 'A regulator publishes a finding against the company after an audit.' },
];
