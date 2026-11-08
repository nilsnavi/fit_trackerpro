# Coach program versioning

Programs start as version 1. Changes to draft metadata or days increment the
program version. Activating a program freezes its structure; active programs can
only be archived. Coaches create another draft when they need to change an
active plan.

Each assignment stores the program version and a snapshot of the program's
name, description, and ordered days. Program days keep references to the
coach-owned workout templates plus the template version and name used when the
day was built. A template update does not rewrite assignment history. Since the
workout engine starts from the current template body, starting a day is blocked
if that template version has changed; the coach must create and activate a new
program version before clients can start the revised plan.

Only an ACTIVE coach/client relationship permits a new assignment, assignment
status action, or workout start. PAUSED relationships permit viewing history,
but block new work. Assignment transitions are ACTIVE to PAUSED, COMPLETED, or
CANCELLED; PAUSED can resume to ACTIVE or move to either terminal status.
COMPLETED and CANCELLED are terminal. Program archival is also terminal.
