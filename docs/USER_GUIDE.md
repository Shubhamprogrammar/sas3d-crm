# User guide

This guide is for the SAS3D team using the CRM day to day.

## Signing in

Your administrator creates your account and gives you an initial password. Change it under your avatar > your name > **Change password**. If you forget it, use **Forgot password?** on the sign-in page.

## What you can see

| Role | Main access |
|---|---|
| Super Admin | Everything, including company settings and data export |
| Admin | All operations and reports. Cannot change company settings or manage other admins |
| Sales | Your leads, pipeline, follow-ups, proposals and clients |
| Project Manager | Your projects, milestones, tasks and team workload |
| Developer | Projects you are on, your tasks, work notes and file uploads |
| Finance | Invoices, payments, clients and financial reports |

If something is missing from your menu, your role does not include it.

## Finding things

Use the search bar at the top (Ctrl or Cmd + K) to find leads, clients, projects, proposals, invoices and tasks. The **Create** button starts a new record from anywhere.

## Working a lead

1. **Add it:** Leads > New lead, or Import for a CSV. If the email or phone already exists, you see a warning and can choose **Create anyway**.
2. **Track contact:** on the lead, use **Communication > Log communication** after each call, email or meeting. Set a next follow-up to get a reminder.
3. **Move it along:** drag its card on the Pipeline, or use the **...** menu on the card (this also works by keyboard and on phones).
4. **Close it:** moving to **Lost** asks for a reason. Moving to **Won** offers to create the client and project.

Won deals can be converted later from the card or lead page. Converting twice never creates duplicates, and a client with the same email is reused.

Archiving hides a lead and its card. Tick **Show archived** on the Leads page to restore it.

## CSV import

The first row must contain column names. **Full Name** is required. Others are Company, Email, Phone, WhatsApp, Country, State, City, Timezone, Website, LinkedIn, Source, Priority, Description and Requirements. After importing you see how many were created, skipped as duplicates or failed, with the row number of each failure.

## Tasks and reminders

Tasks can stand alone or link to a lead, client or project. Switch between list and calendar at the top right. A task with no time is due at the end of its day. The system checks every few minutes and sends a notification when something is due within 24 hours or overdue, even if nobody has the app open.

## Proposals

1. Proposals > New proposal, or **Create proposal** on a lead or client page.
2. Add line items. Picking a service fills in its name, and its price when the currencies match. Totals update as you type.
3. **Download PDF** to review it.
4. **Email to client** sends the PDF. If email is not set up, you get an error and the status does not change. To send it yourself, download it and choose **... > Mark as sent**.
5. Record the outcome with **Mark accepted** or **Mark as rejected**. Accepting moves a linked opportunity to Won and locks the proposal.

Each edit saves the previous version under **Revision history**. Sending or accepting a proposal linked to a lead moves its pipeline card forward automatically.

## Projects

The **Progress** figure is the share of milestones and tasks completed, leaving out cancelled ones. Add updates, work notes and client feedback under **Updates and feedback**, and deliverables under **Files**.

If a task is assigned to you, you can change its status and notes. Managers can change everything else.

## Invoices and payments

1. Invoices > New invoice creates a **draft**, which you can freely edit or delete.
2. **Issue invoice** marks it sent, locks it and counts it in reports. This does not email the client; use **... > Email to client** for that.
3. **Record payment** when money arrives. Partial payments are fine. The payment must be in the invoice currency and cannot exceed the balance. Adding the transaction reference stops the same payment being entered twice.

The status updates itself to Partially paid, Paid or Overdue.

**Mistakes:**
- Wrong payment: choose **Void** beside it, with a reason. The record stays and the balance is restored.
- Wrong invoice: void its payments, then choose **... > Cancel invoice**, and create a new one. Issued invoices cannot be edited or deleted, to keep financial history accurate.

## Reports and dashboard

The dashboard's date filter applies to new leads, proposals sent, revenue and charts. Totals such as active leads and outstanding balances are always current.

Money is always shown per currency and never added across currencies. Use the currency selector on money charts. The table icon on any chart shows its figures as a table. **Revenue collected** counts payments received, while **Invoiced by service** counts issued invoice lines before discount and tax.

Reports > **Export CSV** downloads the current report for the chosen period.

## Notifications

The bell shows your unread count. Click an item to open the record. Choose which types you receive under your profile > **Notification preferences**.

## Settings (Super Admin)

- **Company:** name, logo and details printed on documents.
- **Preferences:** default currency, company timezone, date and time formats.
- **Documents:** number formats, default terms, payment terms and bank details printed on invoices. Set these before issuing your first documents.
- **Users and roles:** view the permission matrix. Manage accounts under **Team**.
- **System:** email and job status, data export and the activity log.

Times show in the company timezone, except on leads and clients with their own timezone, where meeting and follow-up times show in theirs.
