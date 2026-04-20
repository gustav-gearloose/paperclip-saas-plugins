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

---

## Pipedrive

**Env vars:** `APITOKENREF`

**Where to find them:**
1. Log in to your Pipedrive account → click your avatar (top-right) → **Personal preferences**
2. Go to the **API** tab
3. Copy your **personal API token** (shown at the top)

```bash
PC_PASSWORD=<pw> \
  APITOKENREF=<pipedrive-api-token> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-pipedrive
```

---

## Intercom

**Env vars:** `ACCESSTOKENREF`

**Where to find them:**
1. Log in to Intercom → click **Settings** (bottom-left gear icon)
2. Go to **Integrations → Developer Hub**
3. Open your app (or create one) → **Authentication**
4. Copy the **Access Token** (this is a long-lived token for your workspace)

```bash
PC_PASSWORD=<pw> \
  ACCESSTOKENREF=<intercom-access-token> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-intercom
```

---

## Jira

**Env vars:** `APITOKENREF`, `PLUGIN_CONFIG_email`, `PLUGIN_CONFIG_domain`

**Where to find them:**
1. Log in to Atlassian → go to **account.atlassian.com/manage-profile/security/api-tokens**
2. Click **Create API token** → give it a name → copy the token
3. Your **email** is the Atlassian account email
4. Your **domain** is the subdomain from your Jira URL: `mycompany.atlassian.net` → `mycompany`

```bash
PC_PASSWORD=<pw> \
  APITOKENREF=<jira-api-token> \
  PLUGIN_CONFIG_email=<your-atlassian-email> \
  PLUGIN_CONFIG_domain=<your-atlassian-subdomain> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-jira
```

---

## GitHub

**Env vars:** `TOKENREF`, `PLUGIN_CONFIG_owner` (optional)

**Where to find them:**
1. Log in to GitHub → go to **Settings → Developer settings → Personal access tokens**
2. Click **Generate new token (classic)** or use **Fine-grained tokens** (recommended)
   - For classic: select scopes `repo`, `read:org` (adjust as needed)
   - For fine-grained: choose specific repos and grant **Contents**, **Issues**, **Pull requests**, **Metadata** read/write as needed
3. Copy the token
4. **Default owner** is optional — set to your GitHub username or org name to avoid having to pass `owner` in every tool call

```bash
PC_PASSWORD=<pw> \
  TOKENREF=<github-personal-access-token> \
  PLUGIN_CONFIG_owner=<github-username-or-org> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-github
```

---

## Freshdesk

**Env vars:** `APIKEYREF`, `PLUGIN_CONFIG_domain`

**Where to find them:**
1. Log in to Freshdesk → click your avatar (top right) → **Profile Settings**
2. Your **API Key** is shown in the right sidebar under "Your API Key"
3. Your **domain** is the subdomain from your Freshdesk URL: `mycompany.freshdesk.com` → `mycompany`

```bash
PC_PASSWORD=<pw> \
  APIKEYREF=<freshdesk-api-key> \
  PLUGIN_CONFIG_domain=<freshdesk-subdomain> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-freshdesk
```

---

## Stripe

**Env vars:** `SECRETKEYREF`

**Where to find it:**
1. Log in to [dashboard.stripe.com](https://dashboard.stripe.com) → **Developers → API keys**
2. Use your **Secret key** (`sk_live_...` for production, `sk_test_...` for testing)
3. Never use the Publishable key here — only the Secret key

```bash
PC_PASSWORD=<pw> \
  SECRETKEYREF=<stripe-secret-key> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-stripe
```

---

## WooCommerce

**Env vars:** `CONSUMERKEYREF`, `CONSUMERSECRETREF`, `PLUGIN_CONFIG_siteUrl`

**Where to find them:**
1. Log in to your WordPress admin → **WooCommerce → Settings → Advanced → REST API**
2. Click **Add key** — give it a name, set permissions to **Read/Write**
3. Copy the **Consumer Key** and **Consumer Secret** (shown only once after creation)
4. Your **store URL** is the root of your WordPress site, e.g. `https://myshop.com`

```bash
PC_PASSWORD=<pw> \
  CONSUMERKEYREF=<woocommerce-consumer-key> \
  CONSUMERSECRETREF=<woocommerce-consumer-secret> \
  PLUGIN_CONFIG_siteUrl=https://myshop.com \
  ./scripts/provision-plugin.sh <slug> packages/plugin-woocommerce
```

---

## Shopify

**Env vars:** `ACCESSTOKENREF`, `PLUGIN_CONFIG_shopDomain`

**Where to find them:**
1. Log in to your Shopify Admin → **Apps → Develop apps** (enable developer tools if prompted)
2. Click **Create an app**, give it a name, then go to **Configuration → Admin API integration**
3. Select scopes: `read_orders`, `read_products`, `write_products`, `read_customers`, `read_price_rules`, `read_inventory`, `read_locations`
4. Click **Install app** — copy the **Admin API access token** (shown only once)
5. Your **shop domain** is `yourstore.myshopify.com`

```bash
PC_PASSWORD=<pw> \
  ACCESSTOKENREF=<shopify-admin-access-token> \
  PLUGIN_CONFIG_shopDomain=yourstore.myshopify.com \
  ./scripts/provision-plugin.sh <slug> packages/plugin-shopify
```

---

## monday.com

**Env vars:** `APITOKENREF`

**Where to find it:**
1. Log in to [monday.com](https://monday.com) → click your avatar (top-right) → **Developers**
2. Go to **My Access Tokens** → click **Show** to reveal your personal API token
3. Copy the token (starts with `eyJ...`)

```bash
PC_PASSWORD=<pw> \
  APITOKENREF=<monday-api-token> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-monday
```

---

## Asana

**Env vars:** `ACCESSTOKENREF`

**Where to find it:**
1. Log in to [app.asana.com](https://app.asana.com) → click your avatar (top-right) → **My Settings**
2. Go to the **Apps** tab → scroll to **Manage Developer Apps**
3. Click **New Access Token** → give it a name → copy the token

```bash
PC_PASSWORD=<pw> \
  ACCESSTOKENREF=<asana-personal-access-token> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-asana
```

---

## Salesforce (CRM)

**Env vars:** `ACCESSTOKENREF`, `REFRESHTOKENREF`, `CLIENTIDREF`, `CLIENTSECRETREF`, `PLUGIN_CONFIG_instanceUrl`

**Where to find them:**
1. Log in to Salesforce → go to **Setup → Apps → App Manager → New Connected App**
2. Enable OAuth settings, add callback URL (e.g. `https://login.salesforce.com/services/oauth2/callback`)
3. Add scopes: `Full access (full)` or `api`, `refresh_token`, `offline_access`
4. After saving, note the **Consumer Key** (Client ID) and **Consumer Secret** (Client Secret)
5. Authorize the app using OAuth2 Authorization Code flow to obtain an **Access Token** and **Refresh Token**
6. Your **Instance URL** is shown in the URL when logged in: e.g. `https://yourorg.my.salesforce.com`

```bash
PC_PASSWORD=<pw> \
  ACCESSTOKENREF=<salesforce-access-token> \
  REFRESHTOKENREF=<salesforce-refresh-token> \
  CLIENTIDREF=<salesforce-consumer-key> \
  CLIENTSECRETREF=<salesforce-consumer-secret> \
  PLUGIN_CONFIG_instanceUrl=https://yourorg.my.salesforce.com \
  ./scripts/provision-plugin.sh <slug> packages/plugin-salesforce
```

## Trello (project boards)

**Env vars:** `APIKEYREF`, `APITOKENREF`

**Where to find them:**
1. Go to <https://trello.com/power-ups/admin> and create a new Power-Up (or use an existing one)
2. Under **API Key**, copy your **API Key**
3. Click **Token** next to the API Key to generate a **Token** with read/write access
4. Store each value as a Paperclip secret

```bash
PC_PASSWORD=<pw> \
  APIKEYREF=<trello-api-key> \
  APITOKENREF=<trello-api-token> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-trello
```

## ClickUp (project management)

**Env vars:** `APITOKENREF`

**Where to find them:**
1. Log in to ClickUp → click your avatar (bottom-left) → **Apps**
2. Under **API Token**, click **Generate** (or copy the existing token)
3. Store the token as a Paperclip secret

```bash
PC_PASSWORD=<pw> \
  APITOKENREF=<clickup-api-token> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-clickup
```

## Todoist (task management)

**Env vars:** `APITOKENREF`

**Where to find them:**
1. Log in to Todoist → click your avatar (top-right) → **Settings → Integrations → Developer**
2. Copy your **API token**
3. Store it as a Paperclip secret

```bash
PC_PASSWORD=<pw> \
  APITOKENREF=<todoist-api-token> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-todoist
```

## Airtable (database / spreadsheet hybrid)

**Env vars:** `APIKEYREF`

**Where to find them:**
1. Log in to Airtable → click your avatar (top-right) → **Account**
2. Go to **Developer hub → Personal access tokens**
3. Click **Create new token**, give it a name, and grant these scopes:
   - `data.records:read`, `data.records:write`
   - `schema.bases:read`
4. Select which bases it can access (or choose **All current and future bases**)
5. Copy the generated token — it starts with `pat`
6. Store it as a Paperclip secret

```bash
PC_PASSWORD=<pw> \
  APIKEYREF=<airtable-personal-access-token> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-airtable
```

## Harvest (time tracking)

**Env vars:** `APITOKENREF`, `PLUGIN_CONFIG_accountId`

**Where to find them:**
1. Log in to Harvest → go to <https://id.getharvest.com/developers>
2. Click **Create new personal access token**, give it a name, and copy the token
3. Your **Account ID** is shown on the same page (a numeric ID)
4. Store the token as a Paperclip secret; the Account ID goes into plugin config

```bash
PC_PASSWORD=<pw> \
  APITOKENREF=<harvest-personal-access-token> \
  PLUGIN_CONFIG_accountId=<harvest-account-id> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-harvest
```

## Typeform (surveys)

**Env vars:** `APITOKENREF`

**Where to find them:**
1. Log in to Typeform → click your avatar (top-right) → **Settings → Personal tokens**
2. Click **Generate a new token**, give it a name, and copy the token
3. Store it as a Paperclip secret

```bash
PC_PASSWORD=<pw> \
  APITOKENREF=<typeform-personal-access-token> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-typeform
```

## Calendly (scheduling)

**Env vars:** `APITOKENREF`

**Where to find them:**
1. Log in to Calendly → click your avatar → **Integrations & apps → API & Webhooks**
2. Click **Generate new token**, give it a name, and copy the Personal Access Token
3. Store it as a Paperclip secret

```bash
PC_PASSWORD=<pw> \
  APITOKENREF=<calendly-personal-access-token> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-calendly
```

## Mailchimp (email marketing)

**Env vars:** `APIKEYREF`, `PLUGIN_CONFIG_serverPrefix`

**Where to find them:**
1. Log in to Mailchimp → click your avatar → **Profile → Extras → API keys**
2. Click **Create a Key**, give it a name, and copy it — the key ends with `-us14` or similar; the suffix before the dash is your **Server Prefix** (e.g. `us14`)
3. Store the full API key as a Paperclip secret; set `serverPrefix` to the prefix (e.g. `us14`)

```bash
PC_PASSWORD=<pw> \
  APIKEYREF=<mailchimp-api-key> \
  PLUGIN_CONFIG_serverPrefix=us14 \
  ./scripts/provision-plugin.sh <slug> packages/plugin-mailchimp
```

## ActiveCampaign (CRM & automation)

**Env vars:** `APIKEYREF`, `PLUGIN_CONFIG_accountUrl`

**Where to find them:**
1. Log in to ActiveCampaign → **Settings → Developer**
2. Copy your **API Key** and note your **API URL** (e.g. `https://youraccountname.api-us1.com`)
3. Store the API key as a Paperclip secret; set `accountUrl` to the API URL

```bash
PC_PASSWORD=<pw> \
  APIKEYREF=<activecampaign-api-key> \
  PLUGIN_CONFIG_accountUrl=https://youraccountname.api-us1.com \
  ./scripts/provision-plugin.sh <slug> packages/plugin-activecampaign
```

## Twilio (SMS & voice)

**Env vars:** `AUTHTOKENREF`, `PLUGIN_CONFIG_accountSid`

**Where to find them:**
1. Log in to Twilio Console → the **Account SID** and **Auth Token** are on the dashboard homepage
2. Store the Auth Token as a Paperclip secret; set `accountSid` to the Account SID (starts with `AC...`)

```bash
PC_PASSWORD=<pw> \
  AUTHTOKENREF=<twilio-auth-token> \
  PLUGIN_CONFIG_accountSid=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  ./scripts/provision-plugin.sh <slug> packages/plugin-twilio
```

## Brevo (email marketing)

**Env vars:** `APIKEYREF`

**Where to find them:**
1. Log in to Brevo → top-right menu → **SMTP & API** → **API Keys** tab
2. Create or copy an existing API key (starts with `xkeysib-...`)
3. Store it as a Paperclip secret

```bash
PC_PASSWORD=<pw> \
  APIKEYREF=<brevo-api-key> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-brevo
```

## SendGrid (email)

**Env vars:** `APIKEYREF`

**Where to find them:**
1. Log in to SendGrid → Settings → **API Keys**
2. Create a key with at least **Mail Send** + **Marketing** permissions
3. Store it as a Paperclip secret

```bash
PC_PASSWORD=<pw> \
  APIKEYREF=<sendgrid-api-key> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-sendgrid
```

## Klaviyo (email/SMS marketing)

**Env vars:** `APIKEYREF`

**Where to find them:**
1. Log in to Klaviyo → Account → Settings → **API Keys**
2. Create a **Private API key** (Full Access or select the scopes you need)
3. Store it as a Paperclip secret

```bash
PC_PASSWORD=<pw> \
  APIKEYREF=<klaviyo-private-api-key> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-klaviyo
```

## Zoho CRM (CRM records, deals, contacts)

**Env vars:** `ACCESSTOKENREF`, `PLUGIN_CONFIG_domain`

**Where to find them:**
1. Log in to the [Zoho Developer Console](https://api-console.zoho.com/)
2. Create an OAuth 2.0 client (Server-based application) and generate an **access token** for the `ZohoCRM.modules.ALL` scope
3. Store the access token as a Paperclip secret
4. Choose your regional domain: `zohoapis.com` (US), `zohoapis.eu` (EU), `zohoapis.in` (IN), `zohoapis.com.cn` (CN)

```bash
PC_PASSWORD=<pw> \
  ACCESSTOKENREF=<zoho-access-token-secret-uuid> \
  PLUGIN_CONFIG_domain=zohoapis.com \
  ./scripts/provision-plugin.sh <slug> packages/plugin-zoho-crm
```

## Mailgun (transactional email)

**Env vars:** `APIKEYREF`, `PLUGIN_CONFIG_domain`, `PLUGIN_CONFIG_region`

**Where to find them:**
1. Log in to Mailgun → Account → **API Keys**
2. Copy your **Private API key** and store it as a Paperclip secret
3. Note your sending domain (e.g. `mg.example.com`) from Sending → Domains
4. Choose region: `us` (api.mailgun.net) or `eu` (api.eu.mailgun.net)

```bash
PC_PASSWORD=<pw> \
  APIKEYREF=<mailgun-private-api-key> \
  PLUGIN_CONFIG_domain=mg.example.com \
  PLUGIN_CONFIG_region=us \
  ./scripts/provision-plugin.sh <slug> packages/plugin-mailgun
```

## Postmark (transactional email)

**Env vars:** `SERVERTOKENREF`

**Where to find them:**
1. Log in to Postmark → select your **Server** → API Tokens tab
2. Copy the **Server API token**
3. Store it as a Paperclip secret

```bash
PC_PASSWORD=<pw> \
  SERVERTOKENREF=<postmark-server-api-token> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-postmark
```

---

## Microsoft Outlook (email + calendar)

**Env vars:** `CLIENTIDREF`, `CLIENTSECRETREF`, `PLUGIN_CONFIG_tenantId`, `PLUGIN_CONFIG_userPrincipalName`

> If you already have a Teams plugin set up, the **same Azure AD app** can be reused — just grant it the additional Graph API permissions below.

**Where to find them:**
1. Go to [Azure Portal](https://portal.azure.com) → Azure Active Directory → App registrations → select (or create) your app
2. **Tenant ID**: Azure Active Directory → Overview → Tenant ID
3. **Client ID**: App registrations → your app → Overview → Application (client) ID
4. **Client Secret**: your app → Certificates & secrets → New client secret
5. **Required API permissions** (Application, not Delegated): `Mail.Read`, `Mail.Send`, `Calendars.ReadWrite`
6. Click **Grant admin consent** for your tenant
7. **userPrincipalName**: the mailbox email address to access, e.g. `assistant@company.com`

```bash
PC_PASSWORD=<pw> \
  CLIENTIDREF=<azure-client-id> \
  CLIENTSECRETREF=<azure-client-secret> \
  PLUGIN_CONFIG_tenantId=<azure-tenant-id> \
  PLUGIN_CONFIG_userPrincipalName=<mailbox@company.com> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-outlook
```

---

## Microsoft OneDrive (files + SharePoint)

**Env vars:** `CLIENTIDREF`, `CLIENTSECRETREF`, `PLUGIN_CONFIG_tenantId`, `PLUGIN_CONFIG_userPrincipalName`

> Uses the **same Azure AD app** as Teams and Outlook — just add the extra Graph permission below.

**Where to find them:**
1. Go to [Azure Portal](https://portal.azure.com) → Azure Active Directory → App registrations → select your app
2. **Required additional API permission** (Application): `Files.Read.All` (add `Files.ReadWrite.All` if upload/delete needed)
3. Click **Grant admin consent** for your tenant
4. **userPrincipalName**: the OneDrive account to access by default, e.g. `user@company.com` — each tool call can override this

```bash
PC_PASSWORD=<pw> \
  CLIENTIDREF=<azure-client-id> \
  CLIENTSECRETREF=<azure-client-secret> \
  PLUGIN_CONFIG_tenantId=<azure-tenant-id> \
  PLUGIN_CONFIG_userPrincipalName=<user@company.com> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-onedrive
```

---

## Google Drive

**Env vars:** `SERVICEACCOUNTJSONREF`, `PLUGIN_CONFIG_delegatedUser`

**Where to find them:**
1. Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Enable **Google Drive API**
2. IAM & Admin → Service Accounts → Create a service account → Create key (JSON)
3. Store the full JSON key file content as a Paperclip secret → copy its UUID as `SERVICEACCOUNTJSONREF`
4. **Domain-wide delegation** (Google Workspace only): Admin Console → Security → API Controls → Domain-wide delegation → Add your service account Client ID with scope `https://www.googleapis.com/auth/drive`
5. **delegatedUser**: email of the Workspace user whose Drive to access (leave empty to act as the service account itself — only sees files explicitly shared with the service account)

```bash
PC_PASSWORD=<pw> \
  SERVICEACCOUNTJSONREF=<secret-uuid> \
  PLUGIN_CONFIG_delegatedUser=<user@company.com> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-google-drive
```

---

## Confluence (pages + knowledge base)

**Env vars:** `APITOKENREF`, `PLUGIN_CONFIG_email`, `PLUGIN_CONFIG_domain`

> Uses the **same Atlassian API token** as Jira — if you already have Jira set up, no new token needed.

**Where to find them:**
1. Go to [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens) → Create API token
2. **domain**: your Atlassian subdomain, e.g. `mycompany` (from `mycompany.atlassian.net`)
3. **email**: the Atlassian account email that owns the token

```bash
PC_PASSWORD=<pw> \
  APITOKENREF=<secret-uuid> \
  PLUGIN_CONFIG_email=<you@company.com> \
  PLUGIN_CONFIG_domain=<mycompany> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-confluence
```

---

## Dropbox (file storage)

**Env vars:** `ACCESSTOKENREF`

**Where to find them:**
1. Go to [dropbox.com/developers/apps](https://www.dropbox.com/developers/apps) → Create app → Scoped access → Full Dropbox
2. Under **Permissions**, enable: `files.content.read`, `files.content.write`, `files.metadata.read`, `files.metadata.write`, `sharing.read`, `sharing.write`
3. Under **Settings** → OAuth 2 → Generated access token → click **Generate** (long-lived token)
4. Store the token as a Paperclip secret → copy its UUID as `ACCESSTOKENREF`

> For production use, consider using the OAuth2 refresh-token flow instead of a generated token.

```bash
PC_PASSWORD=<pw> \
  ACCESSTOKENREF=<secret-uuid> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-dropbox
```

---

## Freshsales (Freshworks CRM)

**Env vars:** `APIKEYREF`, `PLUGIN_CONFIG_domain`

**Where to find them:**
1. Log in to your Freshsales account
2. Click your profile icon → **Profile Settings** → **API Settings**
3. Copy the **API Key** → store as a Paperclip secret → copy its UUID as `APIKEYREF`
4. **domain**: your Freshworks subdomain (e.g. `mycompany` from `mycompany.myfreshworks.com`)

> Uses simple API key auth — no OAuth2 required.

```bash
PC_PASSWORD=<pw> \
  APIKEYREF=<secret-uuid> \
  PLUGIN_CONFIG_domain=<mycompany> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-freshsales
```

---

## BambooHR

**Env vars:** `APIKEYREF`, `PLUGIN_CONFIG_domain`

**Where to find them:**
1. Log in to BambooHR as an admin
2. Click your name (top-right) → **API Keys**
3. Click **Add New Key**, name it (e.g. `Paperclip AI`), copy the key
4. Store the API key as a Paperclip secret → copy its UUID as `APIKEYREF`
5. **domain**: your BambooHR subdomain (e.g. `mycompany` from `mycompany.bamboohr.com`)

> Uses HTTP Basic auth — `apiKey:x` Base64 encoded. No OAuth2 required.

```bash
PC_PASSWORD=<pw> \
  APIKEYREF=<secret-uuid> \
  PLUGIN_CONFIG_domain=<mycompany> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-bamboohr
```

---

## Personio

**Env vars:** `CLIENTIDREF`, `CLIENTSECRETREF`

**Where to find them:**
1. Log in to Personio as an admin
2. Go to **Settings → Integrations → API credentials**
3. Click **Generate new credentials** — name it `Paperclip AI`
4. Enable the employee attributes the agent should be able to read (e.g. first name, last name, email, department, position)
5. Copy the **Client ID** → store as a Paperclip secret → UUID as `CLIENTIDREF`
6. Copy the **Client Secret** → store as a Paperclip secret → UUID as `CLIENTSECRETREF`

> The plugin fetches a short-lived bearer token on startup using client_id + client_secret (POST /auth). No OAuth2 redirect flow required.

```bash
PC_PASSWORD=<pw> \
  CLIENTIDREF=<secret-uuid> \
  CLIENTSECRETREF=<secret-uuid> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-personio
```

---

## Podio

**Env vars:** `CLIENTIDREF`, `CLIENTSECRETREF`, `APPTOKENREF`, `PLUGIN_CONFIG_appId`

**Where to find them:**
1. Log in to [podio.com](https://podio.com) → click your avatar → **Account Settings**
2. Go to **API Keys** → **Generate API Key** — note the **Client ID** and **Client Secret**
3. Go to the Podio app you want the agent to access → open the app in the sidebar
4. Click the wrench icon (App settings) → **Developer** → copy the **App ID** and **App Token**
5. Store Client ID as a Paperclip secret → UUID as `CLIENTIDREF`
6. Store Client Secret as a Paperclip secret → UUID as `CLIENTSECRETREF`
7. Store App Token as a Paperclip secret → UUID as `APPTOKENREF`
8. **PLUGIN_CONFIG_appId**: the numeric App ID (not secret — plain config value)

> Uses Podio app authentication (grant_type=app). The plugin authenticates once on startup with client credentials + app credentials.

```bash
PC_PASSWORD=<pw> \
  CLIENTIDREF=<secret-uuid> \
  CLIENTSECRETREF=<secret-uuid> \
  APPTOKENREF=<secret-uuid> \
  PLUGIN_CONFIG_appId=<numeric-app-id> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-podio
```

## Toggl Track (49)

**Where to get credentials:**
1. Log in to Toggl Track → click your avatar → **Profile Settings**
2. Scroll to the bottom — copy the **API Token**

**Env vars:**
| Variable | Value |
|----------|-------|
| `APITOKENREF` | UUID of the Paperclip secret holding the Toggl API token |

```bash
APITOKENREF=<secret-uuid> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-toggl
```

## Harvest (50)

**Where to get credentials:**
1. Log in to Harvest → click your avatar → **Developers**
2. Create a **Personal Access Token** — copy the token and your **Account ID** shown on the same page
   (Account ID is also visible at `https://id.getharvest.com/` after login)

**Env vars:**
| Variable | Value |
|----------|-------|
| `APITOKENREF` | UUID of the Paperclip secret holding the Harvest personal access token |
| `PLUGIN_CONFIG_accountId` | Your numeric Harvest Account ID (plain value, not a secret) |

```bash
APITOKENREF=<secret-uuid> \
  PLUGIN_CONFIG_accountId=<account-id> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-harvest
```
