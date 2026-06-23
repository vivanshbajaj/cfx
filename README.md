# CFx — Codeforces Power Extension

CFx is a Chrome Extension designed to enhance the competitive programming experience on Codeforces through productivity, customization, and contest-focused tools. Built using Manifest V3 and Vanilla JavaScript, the extension integrates seamlessly and directly into the Codeforces interface to provide a cleaner, more efficient workflow for problem solving and contest participation—without the need for clunky external popups.

## Key Features

### Interface Customization
* **Dark Mode**: A fully customized, sleek dark theme for Codeforces.
* **Zen Mode**: One-click focus mode that hides the sidebars, navigation, and footer, expanding the problem statement for distraction-free coding.
* **Instant Theme Switching**: Toggle themes instantly via the native CFx Dashboard without page reloads.

### Practice Enhancement
* **Smart Daily Recommender**: Automatically fetches your Codeforces rating and recommends 3 highly targeted unsolved problems every day (Rating +100 to +300).
* **Faded Solved Problems**: Automatically fades out problems you've already solved on problemset pages.

### Productivity Tools
* **Draggable Problem Timer**: A persistent, floating stopwatch on problem pages that can be dragged anywhere on your screen and remembers its position.
* **One-Click Bookmarking**: Bookmark any problem directly from its page and manage them in the CFx Dashboard.
* **Cloud Sync**: All settings and bookmarks are synchronized across devices using the Chrome Storage Sync API.

### Contest Utilities
* **Multi-Platform Contest Tracker**: A unified dashboard tab showing all upcoming contests across **Codeforces, CodeChef, AtCoder, and LeetCode**.
* **Direct API Integration**: Fetches real-time schedules using the official APIs of each platform.
* **Platform Filters**: Filter upcoming contests by specific platforms with color-coded badges and countdowns.

## Technology Stack

| Component | Technology |
| :--- | :--- |
| **Extension Framework** | Chrome Extension Manifest V3 |
| **Frontend Logic** | Vanilla JavaScript (ES6) |
| **Styling** | Vanilla Custom CSS3 & CSS Variables |
| **Storage** | Chrome Storage API (`sync`, `local`, `sessionStorage`) |
| **Background Processing** | Service Workers |
| **External Data** | Codeforces API, CodeChef API, LeetCode GraphQL, AtCoder Web Scraping |

## Architecture

**Native Content Scripts** (`content.js`, `content.css`, `darkmode.css`)
Inject dynamic functionality directly into Codeforces pages. This architecture replaces traditional popups with a native, built-in "CFx Dashboard" modal that feels like a natural part of the Codeforces website.

**Background Service Worker** (`background.js`)
Handles scheduled background tasks such as polling multi-platform APIs for contest schedules, caching data, and ensuring fast load times.

**Persistent Storage**
Stores user preferences, daily recommendations, and bookmarks using Chrome's synchronized and local storage systems.

## Project Structure
```text
cfx/
├── manifest.json
├── content.js
├── content.css
├── darkmode.css
├── background.js
└── icons/
```

## Technical Highlights
* Built using modern Chrome Extension Manifest V3 architecture.
* Completely **Popup-Free**: UI is injected via native DOM manipulation for a seamless experience.
* Zero external UI frameworks (No React/Vue), ensuring lightning-fast load times.
* Draggable widget logic utilizing `mousedown`/`mousemove` DOM events and LocalStorage coordinate persistence.
* Service worker-based background processing and caching to minimize API rate-limiting.
* Real-time integration with multiple external REST and GraphQL APIs.

## APIs Utilized
* **Codeforces Official API**: `/user.info`, `/user.status`, `/problemset.problems` for ratings, solved status, and problem sets.
* **CodeChef API**: Internal JSON endpoint for contest listings.
* **LeetCode GraphQL API**: Queries `allContests` for upcoming schedules.
* **AtCoder Web Scraping**: Parses the live DOM of AtCoder's contest page using regular expressions.

## Impact
CFx streamlines the competitive programming workflow by stripping away distractions (Zen Mode), focusing your practice (Daily Recommender), and centralizing all your upcoming contests across platforms into a single, lightning-fast native browser extension.
