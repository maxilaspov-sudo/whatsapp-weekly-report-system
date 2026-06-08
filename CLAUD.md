## Product Model
This project is a reusable template.

The goal is to clone this system for multiple companies in the future.

Each company will have its own:
- WhatsApp number
- WhatsApp closed-jobs group
- Database
- Reports
- Settings

Do not hard-code any company name, technician name, group name, phone number, or report recipient.

All company-specific values must come from environment variables or a settings file.

## No n8n
Do not use n8n.
All automation must be built in code using Node.js, TypeScript, and cron jobs.

## Data Preservation
Always save the full original WhatsApp message in the database.

Parsed fields are allowed to be imperfect, but the original message must always be preserved.

## First Build Task
Create the initial project structure and the first working parser.

The first parser must correctly parse this example:

Input:
John $250 check

Output:
technician_name = John
closed_amount = 250
payment_method = Check

Also parse:
Mike 700 cc

Output:
technician_name = Mike
closed_amount = 700
payment_method = Credit Card