# Setu

A small private ledger for money sent between two people in two countries.
Aishwaryya sends pounds, you receive rupees, and both of you can see where it all went.

It is a web page you add to your iPhone home screen, so it behaves like an app
without going anywhere near the App Store.

---

## How it is put together

There are **two repositories**:

| Repo | Visibility | Holds |
|---|---|---|
| `setu` | public | the app — HTML, CSS, JavaScript. No figures of any kind. |
| `setu-data` | **private** | `ledger.json` — every transfer and expense. |

The app is served by GitHub Pages. It reads and writes `ledger.json` through the
GitHub API using a token you enter once per phone.

This matters for privacy: GitHub Pages can only serve static files, so there is no
server to hide behind a password, and a password checked in JavaScript would be
visible to anyone reading the page source. So the page is not what's protected —
the *data* is. A stranger who finds the link sees a "connect your token" screen and
nothing else, because the public repo genuinely contains no numbers.

A useful side effect: every save is a git commit, so `setu-data` holds a complete,
timestamped history of the ledger. Nothing is ever really lost.

---

## Setting it up

### 1. The private data repo

On github.com: **+** → **New repository** → name it `setu-data`, tick **Private**,
tick **Add a README file**, then **Create repository**.

Nothing else to do here. The app creates `ledger.json` by itself on first use.

### 2. Publish the app

In GitHub Desktop: **File → Add Local Repository…** → choose this folder → **Publish
repository**, and **untick "Keep this code private"** (Pages needs a public repo on
the free plan).

Then on github.com, in the `setu` repo: **Settings → Pages → Source: Deploy from a
branch**, branch **main**, folder **/ (root)**, **Save**. About a minute later the
app is live at `https://<your-username>.github.io/setu/`.

### 3. Make a token

github.com → your avatar → **Settings** → **Developer settings** (right at the
bottom of the sidebar) → **Personal access tokens → Fine-grained tokens** →
**Generate new token**:

- **Repository access** → *Only select repositories* → `setu-data`
- **Permissions** → *Repository permissions* → **Contents: Read and write**
- **Expiration** → the longest offered

Copy the `github_pat_…` string — GitHub shows it only once.

### 4. Install on a phone

Open the site in **Safari**, enter `your-username/setu-data` and the token, choose
who you are, and tap **Connect**. Then **Share → Add to Home Screen**.

Send the link and the token to Aishwaryya so she can do the same. She does not
need a GitHub account — the token is what grants access.

---

## Using it

- **+** adds an entry, either money in or money spent.
- For a transfer, record **both** what was sent in £ and what landed in ₹. The app
  works out the real exchange rate after fees, and charts it over time so you can
  see which service is actually treating you best.
- A **purpose** is money set aside for something specific — Rakhi, Pooja, medicines.
  Tag a transfer to a purpose and the app tracks how much of it is left. Anything
  untagged sits in the general pool.
- Pull down on any screen to sync. Entries made offline queue up and go out when the
  connection returns.

---

## Editing the app later

Change the files in this folder, then in GitHub Desktop: **Commit to main** →
**Push origin**. The live site updates within a minute or so.

If you change any file under `js/` or `css/`, bump `VERSION` in [`sw.js`](sw.js) so
phones pick up the new version instead of the cached one.

---

## If something breaks

| What you see | What it means |
|---|---|
| "That token was rejected" | The token expired. Generate a new one and reconnect. |
| "The token lacks permission" | Contents is set to *Read*, not *Read and write*. |
| "Repository not found" | Check the `owner/name` spelling, and that the token lists `setu-data`. |
| "N waiting to sync" | Offline. It will clear itself when the connection returns. |
| Nothing loads at all | GitHub Pages can take a few minutes on the first deploy. |

To move to a different phone, or to hand the device on, use **Settings → Disconnect
this device**, which erases the token locally and leaves the ledger untouched.
