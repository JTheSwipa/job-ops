# JobOps — Windows 11 Setup Guide

This guide covers setting up JobOps on Windows 11 Home using Docker. No Ollama required — we'll use a free cloud AI provider instead.

---

## What You Need

- Windows 11 (Home edition works fine)
- ~4 GB free RAM to spare for Docker
- ~5 GB free disk space
- A free [OpenRouter](https://openrouter.ai) or [Google AI Studio](https://aistudio.google.com) account for the AI features

---

## Step 1 — Enable WSL2 (One-time, requires restart)

Docker on Windows 11 Home uses WSL2 (Windows Subsystem for Linux). Open **PowerShell as Administrator** and run:

```powershell
wsl --install
```

Restart your computer when prompted. After reboot, a Ubuntu terminal may open — you can close it, you don't need it.

> **If you see "Virtual Machine Platform" errors:** Go into your BIOS and enable **Virtualization Technology** (Intel VT-x or AMD-V). It's usually under CPU settings. Every motherboard calls it something slightly different — search `[your PC model] enable virtualization` if you're unsure.

---

## Step 2 — Install Docker Desktop

1. Download Docker Desktop from [https://www.docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop)
2. Run the installer — accept all defaults
3. On first launch, Docker Desktop will ask you to accept the terms — click Accept
4. Wait for the whale icon in the taskbar to stop animating (this means Docker is ready)

> **Important:** Docker Desktop must be running before you use the app. It starts automatically on login by default.

---

## Step 3 — Install Git

Download Git for Windows from [https://git-scm.com/download/win](https://git-scm.com/download/win) and run the installer. Accept all defaults.

---

## Step 4 — Clone the Repository

Open **PowerShell** (no need for Admin) and run:

```powershell
cd C:\Users\YourName\Documents
git clone https://github.com/JTheSwipa/job-ops.git
cd job-ops
```

Replace `YourName` with your actual Windows username, or pick any folder you like.

---

## Step 5 — Set Up the AI Provider (No Ollama Required)

JobOps needs an AI model to score jobs and rewrite your CV. The easiest free option is **OpenRouter**.

### Option A — OpenRouter (Recommended, Free Tier Available)

1. Sign up at [https://openrouter.ai](https://openrouter.ai)
2. Go to **Keys** → **Create Key** → copy the key
3. OpenRouter gives $1 free credit on signup — enough for hundreds of job searches

### Option B — Google Gemini API (Also Free)

1. Go to [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Click **Create API key** → copy it

---

## Step 6 — Create Your `.env` File

In the `job-ops` folder, you'll find a file called `.env.example`. Copy it to `.env`:

```powershell
copy .env.example .env
```

Now open `.env` with Notepad (or any text editor). Find and edit these lines:

**If using OpenRouter:**
```
MODEL=google/gemini-2.0-flash-001
LLM_PROVIDER=openrouter
LLM_API_KEY=sk-or-v1-YOURKEY
```

**If using Google Gemini:**
```
MODEL=gemini-2.0-flash
LLM_PROVIDER=gemini
LLM_API_KEY=AIza-YOURKEY
```

Save the file. That's the minimum needed to get the app running.

> **Notepad tip:** Make sure Windows doesn't save the file as `.env.txt`. In Notepad, use **Save As**, set **Save as type** to **All Files (*.*)**, and type `.env` as the filename.

---

## Step 7 — Start the App

In PowerShell, from inside the `job-ops` folder:

```powershell
docker compose up -d
```

The first run will download and build everything — this takes **5–15 minutes** depending on your internet speed. You'll see a lot of output scrolling by; that's normal.

When it finishes and you see `Container job-ops Started`, open your browser and go to:

```
http://localhost:3005
```

The onboarding wizard will guide you through the rest of the setup.

---

## Stopping and Starting the App

```powershell
# Stop
docker compose down

# Start again later (much faster than the first time)
docker compose up -d
```

---

## Updating to the Latest Version

```powershell
git pull
docker compose up --build -d
```

---

## Troubleshooting

### "Docker daemon is not running"
Open Docker Desktop from the Start Menu and wait for it to fully start (whale icon stops animating), then try again.

### "Port 3005 is already in use"
Something else is using that port. Either close the other app, or change the port in `docker-compose.yml`:
```yaml
ports:
  - "3006:3001"   # change 3005 to any free port
```
Then access the app at `http://localhost:3006`.

### "WSL 2 installation is incomplete"
Run this in PowerShell as Administrator:
```powershell
wsl --update
wsl --set-default-version 2
```
Then restart Docker Desktop.

### The app opens but AI features don't work / scoring returns errors
- Double-check your `.env` file — make sure the API key has no extra spaces
- Make sure you saved it as `.env` and not `.env.txt` (see Step 6 tip above)
- Restart the container after any `.env` change: `docker compose down && docker compose up -d`

### "Cannot connect to the Docker daemon" even though Docker is running
Open Docker Desktop → Settings → General → make sure **"Use WSL 2 based engine"** is checked.

### Windows Defender / Antivirus is very slow or blocks Docker
Add the `job-ops` folder and `%LOCALAPPDATA%\Docker` to your antivirus exclusions. Docker creates many small files that antivirus scanners can slow down significantly.

### App is sluggish or crashes
Docker Desktop limits RAM by default. Go to Docker Desktop → Settings → Resources → increase Memory to at least **3 GB** (4 GB recommended).

---

## What the `.env` File Can Also Configure (Optional)

| Variable | What it does |
|----------|-------------|
| `RXRESUME_API_KEY` | Enables tailored CV/resume generation (get a free key at rxresu.me) |
| `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` | Enables Adzuna job board (multi-country searches) |
| `APIFY_TOKEN` | Enables Seek job board (Australia/NZ) |
| `GMAIL_OAUTH_CLIENT_ID` / `GMAIL_OAUTH_CLIENT_SECRET` | Enables Gmail tracking for application replies |
| `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD` | Password-protects the app if you expose it on a network |

None of these are required to get started.
