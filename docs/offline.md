# Offline use

The School, Clinic and Finance apps keep working for a few tasks without a connection (SPEC.md 10). The rule: **offline, only new records are created.** Editing, deleting, approvals, billing and reports always need a connection, so records saved offline never conflict with anyone else's work.

| App     | Works offline                                                  | Needs a connection                                                                           |
| ------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| School  | Saving a class register; scores for students who have none yet | Signing in, changing saved scores, approvals, locking, course planning, fees, PDFs, settings |
| Clinic  | Registering a patient; recording vitals                        | Signing in, clinical notes (never kept on the device), appointments, billing, reports        |
| Finance | New income and expenses, with a receipt photo of up to 2 MB    | Signing in, transfers, invoices, payroll, voids, reports, settings                           |

## For staff

1. **Install the app** while online: in Chrome or Edge on Windows, click the install icon in the address bar; on Android, choose "Add to Home screen". Open the pages you use (for example Attendance or the Queue) once while online, so they are on the device.
2. **Offline**, the top bar says **Offline**. Save the form as usual: the record appears under "Waiting to sync" with a **Pending sync** badge, and the top bar counts the changes waiting.
3. **Back online**, records are sent automatically: when the connection returns, when you come back to the app, and every minute. They disappear from "Waiting to sync" once the server has them.
4. If a record cannot be sent (for example your account was suspended, or the class was closed), it stays in the list marked **Not synced** with the reason. Fix the cause and press **Sync now**, or **Discard** it (you are asked to confirm).
5. **Signing out** deletes the records and pages kept on the device. If records are still waiting, you are warned first. When a session ends on its own (after 8 hours, or 4 in the Clinic), the device is cleared the same way, so sync before you stop for the day.

## How it works

- The apps are installable (Serwist service worker): the app shell and the pages last opened online are kept on the device; other pages show an offline page. Some pages are never kept: Clinic visits and patient records (they hold clinical notes, SPEC.md 10.1), PDFs, report exports and stored files.
- Records wait in an outbox in the browser's IndexedDB, one per signed-in user (`packages/core/src/offline`). Each record has an id made on the device.
- Each record is sent to the app's sync action, which checks the member's current access and role first (OFF-03), validates the record with the same rules as the online form, and inserts it without overwriting anything already stored. Sending the same record twice stores it once (OFF-02). A Finance receipt photo travels with its record.
- Tests: `e2e/clinic/offline.spec.ts` (patient and vitals; suspended member; sign-out), `e2e/finance/offline.spec.ts` (expense with photo), `e2e/school-hs/offline.spec.ts` (register), and the outbox unit tests in `packages/core`.
