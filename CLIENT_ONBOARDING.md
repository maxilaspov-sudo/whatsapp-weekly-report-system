# Client Onboarding Guide

## What this system does

This bot connects to a WhatsApp group and automates weekly financial reporting for service technicians.

- Listens for closed-job messages posted by technicians in the group
- Parses and saves each valid job to a database
- Generates weekly financial reports broken down by technician and payment method
- Responds to commands sent directly in the WhatsApp group

---

## What this system does NOT do

- Does not manage leads or customer relationships
- Does not schedule or dispatch appointments
- Does not process or initiate payments
- Does not send messages to your customers
- Does not integrate with any CRM or external scheduling software

---

## How to add the bot to a WhatsApp group

1. Your provider supplies a WhatsApp phone number for the bot.
2. Add that phone number as a contact on your phone.
3. Create a new WhatsApp group (or use an existing one) and add the bot's number.
4. Share the exact group ID or group name with your provider so they can register it.
5. Once registered, an authorized admin can send `.start` to activate job processing.

The bot only processes messages from groups that have been explicitly registered. It silently ignores all other groups.

---

## Available commands

All commands begin with a dot (`.`). Send them as plain text messages in the group.

| Command  | Who can use | What it does |
|----------|-------------|--------------|
| `.help`  | Everyone    | Shows available commands |
| `.format`| Everyone    | Shows the expected closed-job message format |
| `.start` | Admins only | Activates job message processing |
| `.stop`  | Admins only | Deactivates job message processing |
| `.status`| Admins only | Shows current system status |
| `.report`| Admins only | Generates last week's financial report |

---

## Example valid closed-job message

Technicians must post messages in this exact structure:

```
[Company Name]

Name: Jane Smith
Phone: (555) 123-4567
Address: 456 Oak Avenue, Springfield
Job type: AC Repair
Appointment Monday 06/09 @ 2pm

Alex $350 check
```

The last line is the closing line: `TechnicianFirstName $Amount PaymentMethod`.

If a message does not match this format, the bot will reply:
> Invalid job format. Send .format to see the required format.

---

## Supported payment methods

The closing line accepts these payment method aliases:

| Alias(es)                        | Recorded as  |
|----------------------------------|--------------|
| `check`, `chk`, `ck`             | Check        |
| `cc`, `credit card`, `credit`    | Credit Card  |
| `cash`                           | Cash         |
| `zelle`                          | Zelle        |
| `venmo`                          | Venmo        |
| `ach`                            | ACH          |
| `wire`                           | Wire         |

---

## Admin permissions

Admin status is configured per group by your provider. It cannot be changed from inside the group.

- `.start`, `.stop`, `.status`, and `.report` require admin authorization.
- Non-admin users who send these commands will receive: *Access denied. You are not authorized to use this command.*
- `.help` and `.format` are available to everyone in the group.

**Unauthorized users cannot start, stop, or read reports under any circumstances.**

---

## Reports are scoped per company and group

Each deployment is fully isolated. Your group's job records and reports are tied to your company ID and group ID. No other company can see your data, and you cannot see theirs.

If you operate multiple groups (e.g. different regions or departments), each group gets its own scoped reports.

---

## Troubleshooting

**Bot does not respond to commands**
- Confirm the group has been registered by your provider.
- Confirm the bot's phone number is in the group.
- Try `.help` — if there is no response, the bot may be offline. Contact your provider.

**Job message is rejected with "Invalid job format"**
- Send `.format` to see the exact expected format.
- Ensure the closing line follows: `FirstName $Amount PaymentMethod`.
- Check that the payment method alias is one of the supported values listed above.

**`.report` returns no data**
- Make sure `.start` was sent to activate processing before messages were posted.
- Messages posted while the bot was inactive are not saved.
- Reports cover the previous calendar week (Monday–Sunday).

**Bot stopped responding after a server restart**
- The bot may need to re-authenticate. Contact your provider.
- Once re-authenticated, send `.start` again to reactivate processing.

**Duplicate message warning**
- If a message was already saved, the bot silently skips it without error. This is expected behavior.
