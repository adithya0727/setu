# Automatic imports from Revolut

When Aishwaryya sends money, Revolut emails you *"You've been sent ₹70,000"*.
[`setu-revolut.gs`](setu-revolut.gs) reads that email and writes the transfer
into `ledger.json` by itself, so the app already knows about it by the time you
next open it.

It runs as a **Google Apps Script** inside your own Google account. That matters:
no Cloud project, no OAuth app to register, no Gmail password stored anywhere,
and no third-party service holding a copy of your mail. It is free, and it stays
free — there is no usage tier to fall off.

---

## The one thing it cannot know

**Revolut only tells the recipient what landed.** The email says ₹70,000; it
never mentions the £ she sent. So an imported entry has the rupees, the date and
the method, and `sentGBP` is left at `0`.

That is deliberate rather than a gap papered over. A guessed rate would quietly
corrupt the one number this app exists to track. Instead the entry shows
**"Add £"** in the list, and **"Not recorded — tap Edit to add it"** in its
detail sheet, until someone fills it in.

The natural person to fill it in is Aishwaryya, on her phone — she is the only
one who knows what left her account. The moment she does, the marker disappears
and the effective rate appears on the entry and in the rate chart.

Until then the entry is simply skipped by the rate chart, so an incomplete row
never invents a data point.

---

## Setting it up

You need `ledger.json` to exist first. If you have never synced the app, open it
on your phone once and add anything — the app creates the file.

### 1. A token for the script

Make a **second** fine-grained token, separate from the one on your phones, so
you can revoke either without disturbing the other:

github.com → avatar → **Settings** → **Developer settings** → **Personal access
tokens → Fine-grained tokens** → **Generate new token**

- **Repository access** → *Only select repositories* → `setu-data`
- **Permissions** → *Repository permissions* → **Contents: Read and write**
- **Expiration** → the longest offered

### 2. Make the script

Go to **[script.google.com](https://script.google.com)** → **New project**.
Rename it something like *Setu importer*. Delete the `myFunction` stub, then
paste in the whole of [`setu-revolut.gs`](setu-revolut.gs). Save.

### 3. Give it the repo and the token

Find `setUp()` near the top. Fill in the two empty strings:

```js
const repo  = 'your-username/setu-data';
const token = 'github_pat_…';
```

Pick `setUp` from the function dropdown and press **Run**.

Google will ask for permission, and will warn you that the app isn't verified —
which is expected, because the "app" is a script you wrote this minute. Click
**Advanced** → **Go to Setu importer (unsafe)** → **Allow**. You are granting it
to yourself.

**Then blank those two strings out again.** From this point the values live in
the project's Script Properties, which is why nothing secret ever appears in
this public repo. Don't paste the token into the copy of the file kept here.

### 4. Check it before it writes anything

Run **`dryRun`**. It reads and parses everything and writes nothing. Open
**Execution log** and you should see a line like:

```
would import  2026-09-09  ₹70,000  (t_gm_199f2a1b3c4d5e6f)
```

If the log says *"No Revolut transfer emails in the last 90d"*, there is nothing
recent to find — send yourself a test or wait for the next real one.

### 5. Turn it on

Run **`installTrigger`** once. It now runs by itself once a day, at around
09:00, for good. Nothing else to maintain until the token expires.

The hour is `CONFIG.runAtHour`, and it's read in the *project's* time zone —
**Project Settings** (the gear in the left sidebar) → **Time zone**. Set that to
your own before installing the trigger, or the run will happen at 9am somewhere
in California.

Once a day is plenty here, because the script doesn't depend on catching an
email as it lands: every run re-reads the last 90 days and imports whatever is
missing. A transfer that arrives just after a run simply turns up in the app the
next morning. The only thing you trade away is finding out about an expired
token within hours rather than within a day.

---

## What you'll see

**In Gmail**, two labels appear as they're needed:

| Label | Meaning |
|---|---|
| `setu/imported` | Went into the ledger. |
| `setu/review` | Looked like a transfer but wasn't importable. You also get one email about it. |

**In `setu-data`**, an ordinary commit — `Transfer ₹70,000 received ·
2026-09-09 — via Revolut email` — written in exactly the format the phone app
uses, so the two are indistinguishable in the file and in the history.

**In the app**, the entry appears on the next sync, marked *Added by Revolut*.

---

## Why it can't be tricked, and can't double-count

**Anyone can put `From: Revolut` on an email.** So before importing, the script
reads Gmail's own `Authentication-Results` header and requires both `dkim=pass`
for `revolut.com` and `dmarc=pass`. Forged mail fails this and is labelled for
review instead. It deliberately ignores `ARC-Authentication-Results`, which is a
relayed claim rather than Gmail's own finding.

**It also checks who sent it.** Only transfers showing `Aishwaryya` as the
sender are imported. Money from anyone else is flagged rather than quietly
credited as if it came from her.

**Nothing can be imported twice.** An entry's id is derived from the Gmail
message id — `t_gm_<message id>` — so re-reading the same email always produces
the same single entry. This is why the script looks back a full 90 days on every
run and doesn't rely on labels to decide what's new: labels are per-thread, and
if Gmail ever grouped two transfers into one thread, a label-based check would
silently skip the second one. Missing money is a much worse failure than reading
an email twice.

**It won't fight with your phone.** If a phone saves while the script is
writing, GitHub rejects the write and the script re-reads and replays — the same
optimistic-concurrency dance [`js/github.js`](../js/github.js) does.

---

## If something breaks

| What you see | What it means |
|---|---|
| Email: *"the Revolut importer is failing"* | Something is wrong with GitHub — usually an expired token. Make a new one and run `setUp()` again. At most one a day. |
| Email: *"Revolut email(s) need a look"* | It found something transfer-shaped it wouldn't import. The reason is in the email; the thread is labelled `setu/review`. |
| *"ledger.json does not exist yet"* | The app has never synced. Open it on a phone once. |
| *"The token lacks Contents: Read and write"* | The token is set to *Read*. |
| Nothing imports, no errors | Revolut changed the email. See below. |
| Entry appeared with no £ | Working as intended — see the top of this page. |

### When Revolut redesigns the email

The parser reads their two-column details table, and falls back to the prose and
then the subject line if that table changes shape. If all of it changes, update
the fixture and check the parser against it without touching your real ledger:

```
node automation/test/parse.test.js
```

[`test/fixture.js`](test/fixture.js) is a copy of a real transfer email. To
refresh it, open a new one in Gmail → **⋮** → **Show original**, and replace the
HTML. The suite covers parsing, the spoofing check, both date formats, Indian
digit grouping, the fallbacks, and the cases that must be refused — such as an
amount that isn't in rupees.

### Things worth changing

All at the top of the script, in `CONFIG`:

- `sender` — the name Revolut shows for her
- `window` — how far back each run looks
- `method`, `addedBy` — how the entry is labelled in the app

`runAtHour` and the daily schedule take effect when you run `installTrigger()`
again — editing `CONFIG` alone doesn't move an installed trigger.
