// lib/help-content.ts
// Per-role in-app help content for the EdProSys dashboards (ISS — "thin user manual").
//
// Plain-language guidance shown by <HelpPanel/> in the shared Layout, keyed by the
// viewer's effective role. Purely additive: no screen logic depends on this.
//
// i18n: content is English-first. To translate, swap the strings here for T(key,lang)
// lookups or a per-lang content map — the HelpPanel renders whatever this returns.

export interface HelpSection {
  title: string;
  body: string;
}

export interface RoleHelp {
  label: string;       // role name shown in the panel header
  intro: string;       // one-line "what this dashboard is for"
  sections: HelpSection[];
}

const HELP_CONTENT: Record<string, RoleHelp> = {
  owner: {
    label: 'Owner',
    intro: 'Your bird\u2019s-eye view of the whole institution.',
    sections: [
      { title: 'See the big picture', body: 'Your home screen rolls up students, staff, attendance and fees collected across the institution. Use it to spot what needs attention.' },
      { title: 'People & settings', body: 'Manage staff, roles and institution settings. Add or amend records from their respective screens.' },
      { title: 'Getting around', body: 'Use the menu (\u2630) to open any section, the back arrow (\u2190) to return, and the search box to jump to a student, parent or staff member by name.' },
    ],
  },
  principal: {
    label: 'Principal',
    intro: 'Academic oversight \u2014 teachers, students and approvals.',
    sections: [
      { title: 'Approvals', body: 'Review and approve staff leave requests from Leave Approvals. Pending items show first.' },
      { title: 'Academics', body: 'Oversee classes, report cards and parent-teacher meetings (PTM). Open a student or staff name to see their full detail card.' },
      { title: 'Getting around', body: 'Menu (\u2630) for sections, back (\u2190) to return, search to find any person quickly.' },
    ],
  },
  admin: {
    label: 'Administrator',
    intro: 'Day-to-day running of the school.',
    sections: [
      { title: 'People', body: 'Manage Students, Parents and Staff. Click a name to open their detail card; use Add to create records and Edit/Delete to change them.' },
      { title: 'Money & operations', body: 'Fees, payroll, vendors, library, meals, hostel, transport and more each have their own screen with add/edit controls.' },
      { title: 'Bulk work', body: 'Use Import to add many records at once from a CSV. The system accepts Indian-format IDs and numbers.' },
      { title: 'Getting around', body: 'Menu (\u2630) opens any section, back (\u2190) returns, and the search box finds any student, parent or staff member by name.' },
    ],
  },
  anganwadi_admin: {
    label: 'Anganwadi Administrator',
    intro: 'Running your anganwadi centre.',
    sections: [
      { title: 'Children & families', body: 'Manage enrolled children and their families. Click a name for the full detail card.' },
      { title: 'Daily care', body: 'Record meals, health checks and attendance from their respective screens.' },
      { title: 'Getting around', body: 'Menu (\u2630) for sections, back (\u2190) to return, search to find a child or family.' },
    ],
  },
  accountant: {
    label: 'Accountant',
    intro: 'Fees, payments and payroll.',
    sections: [
      { title: 'Collect fees', body: 'Raise fee demand, record payments, and track who hasn\u2019t paid under Defaulters. Click a name to see the full payment history.' },
      { title: 'Ledger & payroll', body: 'View the ledger for a running record, and manage staff salaries under Payroll.' },
      { title: 'Export', body: 'Use Tally export to hand figures to your accounting software.' },
    ],
  },
  teacher: {
    label: 'Teacher',
    intro: 'Your classroom \u2014 attendance, marks and homework.',
    sections: [
      { title: 'Mark attendance', body: 'Open Attendance to mark today\u2019s class. You can correct an entry the same way you set it.' },
      { title: 'Marks & homework', body: 'Enter or amend marks under Marks, and set homework under Homework. Lesson Plans keeps your teaching notes.' },
      { title: 'Your own requests', body: 'Apply for leave under Leave; the principal approves it.' },
      { title: 'Getting around', body: 'Use the bottom navigation to switch sections and the back arrow to return.' },
    ],
  },
  parent: {
    label: 'Parent',
    intro: 'Follow your child\u2019s progress and stay in touch.',
    sections: [
      { title: 'Your child', body: 'See attendance, marks, timetable, report cards and homework \u2014 these are view-only updates from the school.' },
      { title: 'Fees & consent', body: 'View and pay fees under Fees, and manage your privacy choices under Consent.' },
      { title: 'Reach the school', body: 'Raise or track an issue under Complaints, and read school updates under Notices.' },
    ],
  },
  student: {
    label: 'Student',
    intro: 'Your school information in one place.',
    sections: [
      { title: 'Your day', body: 'Check your timetable, attendance, marks and homework \u2014 all updated by your school.' },
      { title: 'Getting around', body: 'Use the navigation to switch sections and the back arrow to return.' },
    ],
  },
};

const FALLBACK: RoleHelp = HELP_CONTENT.admin;

/** Return the help guide for a role, falling back to the admin guide if unknown. */
export function getRoleHelp(role: string | null | undefined): RoleHelp {
  if (!role) return FALLBACK;
  return HELP_CONTENT[role] ?? FALLBACK;
}
