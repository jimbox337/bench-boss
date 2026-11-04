# Chrome Web Store privacy disclosures

## Single purpose

Securely connect a user-selected ESPN Fantasy Hockey league to the user’s Bench Boss account for roster and league-setting synchronization.

## Permission justifications

- `cookies`: Reads only `espn_s2` and `SWID` from the ESPN domain after explicit user consent. These cookies are required to access the user’s private ESPN fantasy league.
- `storage`: Keeps a short-lived, extension-local flag for up to ten minutes while the user navigates from the ESPN hockey landing page to a league page. No ESPN credentials are stored in extension storage.
- `tabs`: Opens the ESPN Fantasy Hockey and Bench Boss league-sync pages in response to user actions.
- `https://*.espn.com/*`: Detects the selected hockey league and reads the two required ESPN authentication cookies.
- `https://www.benchboss.pro/*`: Detects whether the extension is installed and hands the approved connection back to the Bench Boss sync page.

## Data usage selections

- Authentication information: **Yes** — ESPN authentication cookies used only for league sync.
- Website content: **Yes** — current ESPN hockey league identifier only.
- Web history: **No** — the extension does not collect or retain browsing history.
- Personally identifiable information: **No** — the extension itself does not collect names, addresses, email addresses, or phone numbers.
- Financial information: **No**.
- Health information: **No**.
- Personal communications: **No**.
- Location: **No**.
- User activity: **No**, other than the explicit connect action needed for the extension’s single purpose.

## Certifications

- Data is not sold or transferred to third parties outside the approved use.
- Data is not used or transferred for purposes unrelated to the extension’s single purpose.
- Data is not used or transferred to determine creditworthiness or for lending purposes.
- Authentication information is sent over HTTPS and encrypted at rest with AES-256-GCM.
- The use of information received from browser APIs adheres to the Chrome Web Store User Data Policy, including the Limited Use requirements.
