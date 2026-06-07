<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AGENTS.md - Project Instructions for manage-hncode

## 1. Product context

This project is `manage-hncode`, an internal management system for HNCode programming club / education center.

Primary users:

* Admin
* Teachers
* Academic staff
* Reception/front desk
* Accountants
* Managers

Main business areas:

* Students
* Parents
* Staff
* Classes
* Schedules
* Sessions
* Attendance
* Tests and learning results
* Tuition and payments
* Payroll
* Roles and permissions
* Reports

This is an internal operations dashboard, not a marketing landing page. Prioritize clarity, reliability, and usability over decorative effects.

---

## 2. Core principles

When making changes, always follow these principles:

1. Keep the system stable.
2. Do not break existing business logic.
3. Do not change database schema unless explicitly requested.
4. Do not change authentication, session, RBAC, or permission logic unless explicitly requested.
5. Do not rename routes, fields, models, or server actions unless explicitly requested.
6. Prefer small, focused changes over large rewrites.
7. Make the UI easier to understand and operate.
8. Preserve existing functionality.
9. Run checks after editing.
10. Explain clearly what was changed.

---

## 3. Tech stack assumptions

This project uses:

* Next.js App Router
* TypeScript
* Tailwind CSS
* Prisma
* PostgreSQL
* Server actions / server components where applicable
* Role-based access control

Before making changes, inspect the actual files instead of assuming structure.

Important files/directories to inspect when relevant:

* `README.md`
* `package.json`
* `src/app`
* `src/components`
* `src/components/app-shell.tsx`
* `src/lib/nav.ts`
* `src/app/globals.css`
* `prisma/schema.prisma`

---

## 4. UI/UX direction

The UI should feel:

* Professional
* Friendly
* Clean
* Scientific
* Easy to scan
* Easy to operate
* Suitable for an education technology center

Avoid:

* Overly colorful UI
* Excessive gradients
* Heavy animation
* Decorative effects that reduce clarity
* Dense layouts with poor spacing
* Tiny text
* Low contrast text
* Unclear buttons
* Inconsistent badges or status colors

Preferred visual style:

* Light, clean dashboard
* White cards
* Subtle borders
* Soft shadows
* Rounded corners
* Clear spacing
* Navy / blue / cyan as main colors
* Soft yellow as occasional HNCode accent
* Consistent status badges
* Responsive layouts

---

## 5. Layout and navigation guidelines

The admin layout should be clear and task-oriented.

Sidebar:

* Group menu items by business area when possible.
* Active menu state must be obvious.
* Menu labels should be short and understandable.
* Icons should be consistent in style.
* Do not make the sidebar visually noisy.
* Mobile/tablet should have a clear open/close menu behavior.

Suggested menu groups:

* Tổng quan
* Học viên & phụ huynh
* Lớp học & giảng dạy
* Kiểm tra & kết quả học tập
* Tài chính
* Nhân sự & phân quyền
* Báo cáo

Header/topbar:

* Show current page title clearly.
* Use breadcrumbs or short descriptions when helpful.
* Keep account/role information compact.
* Do not make the header too tall.
* Important actions should be easy to find.

Dashboard:

* Should work as a real management overview.
* Prefer useful cards and quick actions.
* Show today’s work, upcoming classes, pending tasks, or operational summaries when data exists.
* Do not invent fake business data.
* Use empty states when data is unavailable.

---

## 6. Forms

Forms should be easy for non-technical staff to use.

Rules:

* Labels must be clear.
* Required fields should be obvious.
* Use short helper text for fields that may confuse users.
* Group related fields into sections.
* Use consistent spacing.
* Primary and secondary buttons must be visually distinct.
* Error messages should be understandable.
* Success messages should be visible but not intrusive.
* Avoid overly long forms without grouping.

Do not:

* Change field names or data mapping unless explicitly requested.
* Remove validation logic.
* Change server actions unless necessary for the requested task.

---

## 7. Tables and lists

Management pages often contain dense data. Tables should be readable.

Rules:

* Use clear table headers.
* Keep row spacing comfortable.
* Use badges for status fields.
* Put destructive actions behind confirmation when possible.
* Keep row actions compact.
* Provide empty states for no data.
* If filters/search already exist, make them visually clear.
* Do not add fake filters without working logic.

Suggested badge style:

* Active / completed / paid: green or cyan
* Pending / needs attention: amber
* Error / overdue / inactive: red
* Neutral / draft / archived: slate

---

## 8. Buttons and actions

Use clear action hierarchy.

Primary actions:

* Create
* Save
* Confirm
* Publish
* Add student
* Add class
* Record payment

Secondary actions:

* Cancel
* Back
* View detail
* Edit

Danger actions:

* Delete
* Remove
* Cancel enrollment
* Revoke permission

Rules:

* Primary action should be visually prominent.
* Destructive actions should not look like primary actions.
* Avoid too many buttons with equal visual weight.
* Button text should describe the action clearly.

---

## 9. Responsive behavior

The app must remain usable on:

* Desktop
* Laptop
* Tablet
* Mobile

Rules:

* Dashboard cards should wrap cleanly.
* Tables should scroll horizontally if necessary.
* Forms should become single-column on small screens.
* Sidebar should not block content permanently on mobile.
* Avoid fixed widths that break on small screens.

---

## 10. Data and business logic safety

Do not change these unless explicitly requested:

* Prisma schema
* Migration files
* Authentication flow
* Session logic
* RBAC / permissions
* Password handling
* Payment logic
* Payroll logic
* Attendance logic
* Tuition calculation logic
* Route structure
* Database model names
* Server actions

If a UI change seems to require business logic changes, stop and explain before editing.

---

## 11. Code style

General rules:

* Use TypeScript carefully.
* Prefer existing project patterns.
* Prefer reusable components when a pattern repeats.
* Use Tailwind CSS for styling.
* Avoid inline styles unless necessary.
* Do not add new UI libraries without asking.
* Do not introduce unnecessary dependencies.
* Keep components readable.
* Avoid large files becoming harder to maintain.

Before creating a new component, check whether a similar component already exists.

---

## 12. Accessibility

Follow basic accessibility rules:

* Text must have sufficient contrast.
* Buttons and links must be keyboard accessible.
* Form inputs must have labels.
* Icons used alone should have accessible labels or be hidden if decorative.
* Do not rely only on color to communicate status.
* Focus states should remain visible.

---

## 13. Performance

Avoid changes that make the admin dashboard slow.

Rules:

* Do not add heavy animation.
* Do not add large client-side dependencies unnecessarily.
* Do not fetch excessive data for dashboard cards.
* Prefer server-side data loading patterns already used by the project.
* Be careful when adding charts or large components.

---

## 14. Workflow before editing

Before editing code:

1. Read the relevant files.
2. Identify the smallest safe scope.
3. Explain the planned changes briefly.
4. List the files expected to be modified.
5. Do not make broad unrelated changes.

For UI tasks, first inspect:

* Current layout
* Existing components
* Existing Tailwind patterns
* Existing role/permission constraints

---

## 15. Workflow after editing

After editing, run available checks:

```bash
npm run typecheck
npm run lint
npm run build
```

If one of these scripts does not exist, inspect `package.json` and run the closest available equivalent.

If a command fails:

* Do not hide the failure.
* Report the exact command.
* Summarize the error.
* Explain whether the failure is related to your changes.

---

## 16. Git and safety

Before large changes, suggest creating a commit or checking `git status`.

Do not delete user work.

Do not modify `.env` or secrets.

Do not commit:

* `.env`
* local database files
* build artifacts
* node_modules
* logs
* uploaded private files

---

## 17. UI improvement strategy

When asked to improve the interface, work in phases.

Recommended order:

1. App shell, sidebar, header
2. Dashboard
3. Students and parents pages
4. Classes and schedules
5. Sessions and attendance
6. Tests and learning results
7. Tuition and payments
8. Payroll and staff
9. Reports
10. Roles and permissions

Do not redesign the entire system in one pass unless explicitly requested.

---

## 18. Communication style

When reporting back:

* Be concise.
* Use Vietnamese if the user writes in Vietnamese.
* Explain changed files.
* Explain UI improvements.
* Mention any remaining issues.
* Mention commands run and results.

Good final summary format:

* Files changed
* What improved
* Checks run
* Notes / next steps

---

## 19. Specific UI goal for this project

The desired UI should help center staff answer these questions quickly:

* Hôm nay có lớp nào?
* Lớp nào cần điểm danh?
* Học viên nào cần theo dõi?
* Khoản học phí nào cần xử lý?
* Giáo viên/nhân sự nào liên quan?
* Báo cáo nào cần xem?
* Tôi cần bấm vào đâu để làm việc tiếp?

Design every dashboard and management page with these operational questions in mind.
