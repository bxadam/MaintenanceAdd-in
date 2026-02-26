# Fleet Maintenance Module — Geotab Add-in

A full-featured maintenance tracking add-in for MyGeotab. Includes maintenance reminders with live odometer sync, a triggered-reminder → work order workflow, and a work order log.

---

## 📁 File Structure

```
geotab-maintenance-addin/
├── addin.json              ← Geotab add-in manifest (register this in MyGeotab)
├── assets/
│   └── icon.svg            ← Sidebar icon shown in MyGeotab
├── src/
│   ├── index.html          ← Main UI entry point
│   ├── styles.css          ← All styles
│   ├── data.js             ← Data store (localStorage persistence)
│   ├── geotab.js           ← Geotab API integration + odometer polling
│   └── app.js              ← UI controller (rendering, modals, filters)
└── README.md
```

---

## 🚀 Setup: GitHub Pages Hosting

The fastest way to host and load this add-in is via **GitHub Pages**.

### Step 1 — Create the GitHub repo

1. Go to [github.com](https://github.com) → **New repository**
2. Name it `geotab-maintenance-addin`
3. Set it to **Public**
4. Click **Create repository**

### Step 2 — Upload the files

Upload all files maintaining the folder structure:

```
addin.json
assets/icon.svg
src/index.html
src/styles.css
src/data.js
src/geotab.js
src/app.js
```

Or use Git:

```bash
git clone https://github.com/YOUR_USERNAME/geotab-maintenance-addin.git
cd geotab-maintenance-addin
# Copy all files in, then:
git add .
git commit -m "Initial commit"
git push origin main
```

### Step 3 — Enable GitHub Pages

1. Go to your repo → **Settings** → **Pages**
2. Under **Source**, select **Deploy from a branch**
3. Choose branch: `main`, folder: `/ (root)`
4. Click **Save**

Your add-in will be live at:
```
https://YOUR_USERNAME.github.io/geotab-maintenance-addin/
```

### Step 4 — Update addin.json

Edit `addin.json` and replace `YOUR_USERNAME` with your actual GitHub username:

```json
{
  "icon": "https://YOUR_USERNAME.github.io/geotab-maintenance-addin/assets/icon.svg",
  "url":  "https://YOUR_USERNAME.github.io/geotab-maintenance-addin/src/index.html"
}
```

Commit and push the change.

---

## 🔌 Register in MyGeotab

1. Log in to your MyGeotab database
2. Go to **Administration → System → System Settings → Add-ins**
3. Click **New** (or the `+` button)
4. Paste the **raw URL** of your `addin.json` file:
   ```
   https://YOUR_USERNAME.github.io/geotab-maintenance-addin/addin.json
   ```
5. Click **OK** → **Save**
6. Refresh MyGeotab — **Fleet Maintenance** will appear in the left sidebar

---

## ⚙️ Geotab API Connection

When running inside MyGeotab, `geotab.js` automatically:

- Receives the live `api` object from MyGeotab via the `initialize()` callback
- Fetches all **Devices** (vehicles) from your database
- Polls **StatusData** (odometer) every 30 seconds for vehicles with active reminders
- Updates reminder status (`scheduled` → `due-soon` → `overdue`) in real time
- Surfaces a notification banner when a threshold is crossed

> **Vehicle name matching**: The integration matches Geotab device names (e.g. `TRK-041`) to the Vehicle ID field in your reminders. Make sure the names match exactly.

### Changing the poll interval

In `geotab.js`, find:
```js
const POLL_INTERVAL_MS = 30_000; // 30 seconds
```
Adjust as needed. Geotab recommends no faster than 30s for status data polling.

---

## 🧪 Demo / Standalone Mode

When the add-in is opened outside of MyGeotab (e.g. directly via GitHub Pages URL), it automatically runs in **demo mode**:

- Pre-loaded with sample vehicles and reminders
- Click the 🔔 bell icon in the header to simulate a triggered odometer reminder
- All data persists to `localStorage` between sessions

---

## 💾 Data Persistence

Data is stored in the browser's `localStorage` under these keys:

| Key | Contents |
|---|---|
| `fleetmaint_reminders` | All reminder objects |
| `fleetmaint_workorders` | All work order objects |
| `fleetmaint_wo_counter` | Work order ID counter |
| `fleetmaint_r_counter` | Reminder ID counter |

To connect to a real database backend, replace the `DataStore` methods in `data.js` with `fetch()` calls to your API. The interface contracts (method names and object shapes) are designed to make this a drop-in replacement.

---

## 📋 Features

### Maintenance Reminders Tab
- Create reminders with 4 trigger types: **Odometer**, **Mileage Interval**, **Date**, **Engine Hours**
- Live odometer progress bars synced from Geotab
- Status: `Scheduled` → `Due Soon` (within warn threshold) → `Overdue`
- Priority levels, technician assignment, notes
- Filter by status, vehicle, or search query

### Work Orders Tab
- Full work order log: task, assignee, odometer at service, parts, labor, total cost
- Status lifecycle: `Open` → `In Progress` → `Completed`
- Month-to-date spend tracking
- Auto-created from accepted reminders (with source reminder link)
- Manual creation supported

### Reminder → Work Order Workflow
1. Geotab odometer sync detects a threshold has been crossed
2. Notification banner appears at the top of the screen
3. User clicks **Accept & Create Work Order**
4. A confirmation modal pre-fills details from the reminder
5. On confirm, a Work Order is created and the user is taken to the Work Orders tab

---

## 🛠 Customisation

- **Add more task presets**: Edit the `<select>` options in `app.js` → `_getReminderFormHTML()`
- **Change theme colors**: Edit CSS variables in `styles.css` `:root {}`
- **Backend integration**: Swap `DataStore` methods in `data.js` for API calls
- **Email/SMS notifications**: Add a webhook call in `geotab.js` → `_checkForTriggeredReminders()`

---

## 📄 License

MIT — free to use and modify for your fleet operations.
