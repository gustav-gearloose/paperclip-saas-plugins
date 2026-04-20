# Plugin Credentials Guide

What credentials to gather before provisioning each plugin.
Pass these as env vars to `provision-plugin.sh` (see script header for usage).

---

## Dinero (Danish accounting)

**Env vars:** `DINEROCLIENTIDREF`, `DINEROCLIENTSECRETREF`, `DINEROAPIKEYREF`, `PLUGIN_CONFIG_dineroOrgId`

**Where to find them:**
1. Log in to [dinero.dk](https://dinero.dk)
2. Go to **Indstillinger → API**
3. Create an OAuth2 application — note the **Client ID** and **Client Secret**
4. Copy your **API key** (separate field, also on the API page)
5. Your **Organisation ID** is the number shown in the URL: `dinero.dk/1234/...` → `1234`

```bash
PC_PASSWORD=<pw> \
  DINEROCLIENTIDREF=<client-id> \
  DINEROCLIENTSECRETREF=<client-secret> \
  DINEROAPIKEYREF=<api-key> \
  PLUGIN_CONFIG_dineroOrgId=<org-id> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-dinero
```

---

## Billy (Danish accounting)

**Env vars:** `ACCESSTOKENREF`

**Where to find it:**
1. Log in to [billy.dk](https://www.billy.dk)
2. Go to **Indstillinger → API-adgang**
3. Create a token — copy the full token string

```bash
PC_PASSWORD=<pw> \
  ACCESSTOKENREF=<billy-api-token> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-billy
```

---

## e-conomic (Danish accounting)

**Env vars:** `APPSECRETTOKENREF`, `AGREEMENTGRANTTOKENREF`

**Where to find them:**
1. Log in to [e-conomic.dk](https://www.e-conomic.dk)
2. Go to **Indstillinger → Tilføjelser → Developer**
3. Create an app — note the **App Secret Token**
4. In the same flow, grant the app access to your agreement → note the **Agreement Grant Token**

```bash
PC_PASSWORD=<pw> \
  APPSECRETTOKENREF=<app-secret-token> \
  AGREEMENTGRANTTOKENREF=<agreement-grant-token> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-economic
```

---

## Zendesk (customer support)

**Env vars:** `APITOKENREF`, `PLUGIN_CONFIG_subdomain`, `PLUGIN_CONFIG_email`

**Where to find them:**
1. Log in to your Zendesk instance at `<subdomain>.zendesk.com`
2. Go to **Admin → Apps & Integrations → Zendesk API**
3. Enable token access and create an API token
4. Note your **subdomain** (the part before `.zendesk.com`)
5. Use the **email address** of the agent/admin account that owns the token

```bash
PC_PASSWORD=<pw> \
  APITOKENREF=<zendesk-api-token> \
  PLUGIN_CONFIG_subdomain=<subdomain> \
  PLUGIN_CONFIG_email=<agent@company.com> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-zendesk
```

---

## HubSpot (CRM)

**Env vars:** `ACCESSTOKENREF`

**Where to find it:**
1. Log in to [app.hubspot.com](https://app.hubspot.com)
2. Go to **Settings → Integrations → Private Apps**
3. Create a Private App — grant scopes: `crm.objects.contacts.read/write`, `crm.objects.companies.read/write`, `crm.objects.deals.read/write`, `crm.objects.notes.read/write`
4. Copy the **Access Token** shown after creation

```bash
PC_PASSWORD=<pw> \
  ACCESSTOKENREF=<hubspot-access-token> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-hubspot
```

---

## Slack (messaging)

**Env vars:** `BOTTOKENREF`

**Where to find it:**
1. Go to [api.slack.com/apps](https://api.slack.com/apps) → Create New App → From Scratch
2. Under **OAuth & Permissions**, add Bot Token Scopes:
   `channels:read`, `channels:history`, `chat:write`, `files:write`, `reactions:write`, `search:read`, `users:read`
3. Install the app to your workspace
4. Copy the **Bot User OAuth Token** (starts with `xoxb-`)

```bash
PC_PASSWORD=<pw> \
  BOTTOKENREF=xoxb-... \
  ./scripts/provision-plugin.sh <slug> packages/plugin-slack
```

---

## Google Sheets

**Env vars:** `SERVICEACCOUNTJSONREF`

**Where to find it:**
1. Go to [Google Cloud Console](https://console.cloud.google.com) → Select/create a project
2. Enable the **Google Sheets API** (APIs & Services → Library)
3. Go to **APIs & Services → Credentials → Create Credentials → Service Account**
4. Create the account, then go to its **Keys** tab → Add Key → JSON
5. Download the JSON key file — paste its **entire contents** as the secret value
6. Share any Google Sheet you want the agent to access with the service account email (viewer or editor)

The JSON file is multi-line — use a subshell to read it from disk rather than pasting inline:

```bash
PC_PASSWORD=<pw> \
  SERVICEACCOUNTJSONREF="$(cat /path/to/service-account-key.json)" \
  ./scripts/provision-plugin.sh <slug> packages/plugin-google-sheets
```

Or via the interactive onboard wizard — it reads the value with `read` so multi-line and special chars work fine when you paste.

---

## Notion

**Env vars:** `INTEGRATIONTOKENREF`

**Where to find it:**
1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations) → New Integration
2. Give it a name, select your workspace, set capabilities: **Read content**, **Update content**, **Insert content**
3. Copy the **Internal Integration Token** (starts with `secret_`)
4. In Notion, open each database/page the agent should access → **Share → Invite** → select your integration

```bash
PC_PASSWORD=<pw> \
  INTEGRATIONTOKENREF=secret_... \
  ./scripts/provision-plugin.sh <slug> packages/plugin-notion
```

---

## Linear (issue tracking)

**Env vars:** `APIKEYREF`

**Where to find it:**
1. Go to [linear.app](https://linear.app) → Settings → API → Personal API keys
2. Create a key — copy it immediately (shown only once)

```bash
PC_PASSWORD=<pw> \
  APIKEYREF=lin_api_... \
  ./scripts/provision-plugin.sh <slug> packages/plugin-linear
```

---

## Email (IMAP/SMTP)

**Env vars:** `EMAILPASSWORDREF`, `PLUGIN_CONFIG_emailUser`, `PLUGIN_CONFIG_imapHost`, `PLUGIN_CONFIG_imapPort`, `PLUGIN_CONFIG_smtpHost`, `PLUGIN_CONFIG_smtpPort`, `PLUGIN_CONFIG_displayName`

**Common providers:**

| Provider | IMAP host | IMAP port | SMTP host | SMTP port |
|----------|-----------|-----------|-----------|-----------|
| Gmail | `imap.gmail.com` | 993 | `smtp.gmail.com` | 465 |
| Outlook/M365 | `outlook.office365.com` | 993 | `smtp.office365.com` | 587 |
| your-server.de | `mail.your-server.de` | 993 | `mail.your-server.de` | 465 |

For Gmail: use an [App Password](https://myaccount.google.com/apppasswords) (requires 2FA), not your main password.

```bash
PC_PASSWORD=<pw> \
  EMAILPASSWORDREF=<email-password-or-app-password> \
  PLUGIN_CONFIG_emailUser=agent@company.com \
  PLUGIN_CONFIG_imapHost=imap.gmail.com \
  PLUGIN_CONFIG_imapPort=993 \
  PLUGIN_CONFIG_smtpHost=smtp.gmail.com \
  PLUGIN_CONFIG_smtpPort=465 \
  PLUGIN_CONFIG_displayName="Company Agent" \
  ./scripts/provision-plugin.sh <slug> packages/plugin-email
```

---

## Microsoft Teams

**Env vars:** `CLIENTIDREF`, `CLIENTSECRETREF`, `PLUGIN_CONFIG_tenantId`

**Where to find them:**
1. Go to [Azure Portal](https://portal.azure.com) → Azure Active Directory → App registrations → New registration
2. Note the **Application (client) ID** — this is your Client ID
3. Note the **Directory (tenant) ID** — this is your Tenant ID
4. Go to **Certificates & secrets → New client secret** — copy the **Value** (shown once)
5. Go to **API permissions → Add a permission → Microsoft Graph → Application permissions**
6. Add: `ChannelMessage.Read.All`, `ChannelMessage.Send`, `Channel.ReadBasic.All`, `Team.ReadBasic.All`, `ChatMessage.Read.All`, `TeamMember.Read.All`, `Chat.Read.All`
7. Click **Grant admin consent** for the permissions

```bash
PC_PASSWORD=<pw> \
  CLIENTIDREF=<azure-app-client-id> \
  CLIENTSECRETREF=<azure-app-client-secret> \
  PLUGIN_CONFIG_tenantId=<azure-tenant-id> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-teams
```

---

## Fortnox

**Env vars:** `ACCESSTOKENREF`, `REFRESHTOKENREF`, `CLIENTIDREF`, `CLIENTSECRETREF`

**Where to find them:**
1. Log in to [Fortnox Developer Portal](https://developer.fortnox.se) and create an app
2. Under your app settings, note the **Client ID** and **Client Secret**
3. Authorize the app against the customer's Fortnox company — this produces an **Authorization Code**
4. Exchange the code for tokens using Fortnox's OAuth2 flow:
   ```
   POST https://accounts.fortnox.se/oauth-v1/token
   grant_type=authorization_code&code=<code>&redirect_uri=<redirect>
   ```
   This returns both `access_token` and `refresh_token`
5. The plugin uses the refresh token to keep the access token fresh automatically

**Required scopes:** `companyinformation`, `bookkeeping`, `invoice`, `customer`, `article`, `supplier`

```bash
PC_PASSWORD=<pw> \
  ACCESSTOKENREF=<fortnox-access-token> \
  REFRESHTOKENREF=<fortnox-refresh-token> \
  CLIENTIDREF=<fortnox-client-id> \
  CLIENTSECRETREF=<fortnox-client-secret> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-fortnox
```
