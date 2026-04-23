import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';

type DataSource = 'real-api' | 'mock' | 'frontend-only';

type UATCase = {
  id: string;
  area: string;
  title: string;
  preconditions: string;
  steps: string[];
  expectedResult: string;
  priority: 'Critical' | 'High' | 'Medium';
  dataSource: DataSource;
  dataSourceNote?: string;
};

const uatCases: UATCase[] = [
  // --- Authentication ---
  {
    id: 'AUTH-01',
    area: 'Authentication',
    title: 'Login with valid store manager credentials',
    preconditions: 'User has valid Firebase credentials (storemanager email/password)',
    steps: [
      'Navigate to /login',
      'Enter valid store manager email',
      'Enter valid password',
      'Click "Sign In"',
    ],
    expectedResult:
      'User is redirected to the Dashboard. Header shows store name and manager name. Session is persisted (refreshing the page keeps you logged in).',
    priority: 'Critical',
    dataSource: 'real-api',
    dataSourceNote: 'Firebase Authentication REST API (identitytoolkit.googleapis.com)',
  },
  {
    id: 'AUTH-02',
    area: 'Authentication',
    title: 'Login with invalid credentials',
    preconditions: 'None',
    steps: [
      'Navigate to /login',
      'Enter an invalid email or wrong password',
      'Click "Sign In"',
    ],
    expectedResult:
      'An error message is displayed. User stays on the login page. No session is created.',
    priority: 'Critical',
    dataSource: 'real-api',
    dataSourceNote: 'Firebase Authentication REST API',
  },
  {
    id: 'AUTH-03',
    area: 'Authentication',
    title: 'Logout',
    preconditions: 'User is logged in',
    steps: ['Click "Logout" button in the header'],
    expectedResult:
      'User is redirected to /login. Session is cleared. Navigating to / redirects back to /login.',
    priority: 'High',
    dataSource: 'frontend-only',
    dataSourceNote: 'Session cleared from localStorage, no backend call',
  },
  {
    id: 'AUTH-04',
    area: 'Authentication',
    title: 'Token refresh on expiry',
    preconditions: 'User is logged in and token is about to expire (wait ~55 minutes or manipulate tokenExpiresAt in localStorage)',
    steps: [
      'Perform any API action (e.g. search a customer)',
    ],
    expectedResult:
      'Token is silently refreshed. The API call succeeds. User is NOT logged out.',
    priority: 'High',
    dataSource: 'real-api',
    dataSourceNote: 'Firebase token refresh endpoint (securetoken.googleapis.com)',
  },
  {
    id: 'AUTH-05',
    area: 'Authentication',
    title: 'Protected routes redirect unauthenticated users',
    preconditions: 'User is NOT logged in',
    steps: [
      'Navigate directly to / (Dashboard)',
      'Navigate directly to /customers/new',
      'Navigate directly to /customers/test@example.com',
    ],
    expectedResult:
      'All routes redirect to /login.',
    priority: 'Critical',
    dataSource: 'frontend-only',
    dataSourceNote: 'React Router guard checks session in memory, no API call',
  },
  {
    id: 'AUTH-06',
    area: 'Authentication',
    title: 'Session store_id comes from Firebase custom claim',
    preconditions: 'Fresh login with a user that has the store_id custom claim set on the BE (e.g. storemanager1@monnalisa.com or storemanager2@monnalisa.com)',
    steps: [
      'Log in',
      'Open DevTools → Application → Local Storage → session',
      'Inspect the "storeId" field',
      'Decode the JWT in the "token" field (e.g. at jwt.io) and check the custom claim payload',
    ],
    expectedResult:
      'session.storeId equals the Salesforce Store__c Id embedded in the JWT custom claim (a JSON value like {"store_id":"a0W0E000004p9WdUAI"}). On token refresh, storeId is re-derived from the refreshed idToken. If the user has no claim, a console warning is logged and a fallback store_id is used.',
    priority: 'Critical',
    dataSource: 'real-api',
    dataSourceNote: 'Firebase custom claim set server-side; decoded client-side in extractStoreIdFromToken() / resolveStoreId().',
  },
  {
    id: 'AUTH-07',
    area: 'Authentication',
    title: 'Second test account resolves to its own store',
    preconditions: 'BE has assigned different store_ids to storemanager1@monnalisa.com and storemanager2@monnalisa.com',
    steps: [
      'Log in as storemanager1@monnalisa.com, note session.storeId',
      'Logout, log in as storemanager2@monnalisa.com, note session.storeId',
    ],
    expectedResult:
      'Each account carries its own store_id from its Firebase custom claim. The Dashboard segments are scoped independently per account.',
    priority: 'High',
    dataSource: 'real-api',
    dataSourceNote: 'Validates end-to-end user→store binding without any hardcoding.',
  },
  {
    id: 'AUTH-08',
    area: 'Authentication',
    title: 'Real store name is fetched on login and rendered in the header',
    preconditions: 'Fresh login (cached sessions must be cleared first)',
    steps: [
      'Log in',
      'Look at the top-right of the header bar',
      'Open DevTools → Network and observe the single GET /stores/getStores call that fired during login',
    ],
    expectedResult:
      'Header shows the real Salesforce Store Name (the Name field of the StoreRecord whose Id matches session.storeId), not the old "Milano Boutique" placeholder. localStorage.session.storeName equals that Name. The CustomerNew and CustomerEdit "Store" panels show the same real Name, a derived Location ("Store #X · Country"), the real Store ID, and the sales associate email.',
    priority: 'High',
    dataSource: 'real-api',
    dataSourceNote: 'GET /stores/getStores called once during login(); match by Id; results populate session.storeName + session.storeAddress.',
  },

  // --- Customer Search (Real API) ---
  {
    id: 'SEARCH-01',
    area: 'Customer Search',
    title: 'Search by customer name',
    preconditions: 'User is logged in. At least one customer exists in Salesforce.',
    steps: [
      'Click on the search bar in the header',
      'Type a known customer first name (e.g. "Mario")',
      'Wait for the autocomplete dropdown to appear (300ms debounce)',
    ],
    expectedResult:
      'Dropdown shows matching customers with Name, Email, and Phone. Results are from the real Salesforce backend.',
    priority: 'Critical',
    dataSource: 'real-api',
    dataSourceNote: 'GET /customers/search — Salesforce parameterizedSearch',
  },
  {
    id: 'SEARCH-02',
    area: 'Customer Search',
    title: 'Search by email',
    preconditions: 'User is logged in. A customer with a known email exists.',
    steps: [
      'Type a known customer email (or part of it) in the search bar',
      'Wait for the autocomplete dropdown',
    ],
    expectedResult:
      'Dropdown shows the matching customer(s).',
    priority: 'High',
    dataSource: 'real-api',
    dataSourceNote: 'GET /customers/search — Salesforce parameterizedSearch',
  },
  {
    id: 'SEARCH-03',
    area: 'Customer Search',
    title: 'Search by phone number',
    preconditions: 'User is logged in. A customer with a known phone exists.',
    steps: [
      'Type a known phone number (or part of it) in the search bar',
      'Wait for the autocomplete dropdown',
    ],
    expectedResult:
      'Dropdown shows the matching customer(s) with their phone number visible.',
    priority: 'High',
    dataSource: 'real-api',
    dataSourceNote: 'GET /customers/search — Salesforce parameterizedSearch',
  },
  {
    id: 'SEARCH-04',
    area: 'Customer Search',
    title: 'Search with no results',
    preconditions: 'User is logged in',
    steps: [
      'Type a random string that matches no customer (e.g. "xyznonexistent999")',
      'Wait for the dropdown',
    ],
    expectedResult:
      'Dropdown shows "No customers found matching ..." message with a "Create New Customer" button.',
    priority: 'High',
    dataSource: 'real-api',
    dataSourceNote: 'GET /customers/search returns empty array',
  },
  {
    id: 'SEARCH-05',
    area: 'Customer Search',
    title: 'Select a search result to navigate to profile',
    preconditions: 'User is logged in. Search returns at least one result.',
    steps: [
      'Search for a customer by name',
      'Click on a result in the dropdown',
    ],
    expectedResult:
      'User is navigated to /customers/{email}. The customer profile page loads with data from getAccount API.',
    priority: 'Critical',
    dataSource: 'real-api',
    dataSourceNote: 'GET /customers/search then GET /customers/getAccount',
  },
  {
    id: 'SEARCH-06',
    area: 'Customer Search',
    title: 'Search debounce behavior',
    preconditions: 'User is logged in',
    steps: [
      'Type "Mar" quickly in the search bar',
      'Observe network requests in DevTools',
    ],
    expectedResult:
      'Only ONE API call is made (after 300ms pause), not one per keystroke. A "Searching..." indicator appears briefly.',
    priority: 'Medium',
    dataSource: 'real-api',
    dataSourceNote: 'Verify in Network tab: single GET /customers/search call',
  },
  {
    id: 'SEARCH-07',
    area: 'Customer Search',
    title: 'Close search dropdown by clicking outside',
    preconditions: 'Search dropdown is visible with results',
    steps: [
      'Click anywhere outside the search bar and dropdown',
    ],
    expectedResult:
      'Dropdown closes. Search query text remains in the input.',
    priority: 'Medium',
    dataSource: 'frontend-only',
    dataSourceNote: 'UI behavior only, no API call',
  },
  {
    id: 'SEARCH-08',
    area: 'Customer Search',
    title: 'Clear search input resets dropdown',
    preconditions: 'Search dropdown is visible with results',
    steps: [
      'Clear the search input (backspace or select-all + delete)',
    ],
    expectedResult:
      'Dropdown disappears. No API call is made for empty query.',
    priority: 'Medium',
    dataSource: 'frontend-only',
    dataSourceNote: 'UI behavior only, debounce skips empty queries',
  },

  // --- Customer Creation ---
  {
    id: 'CREATE-01',
    area: 'Customer Creation',
    title: 'Create a new customer with all required fields',
    preconditions: 'User is logged in',
    steps: [
      'Navigate to /customers/new (or click "+ Create New Customer" from search)',
      'Fill in: First Name, Last Name, Email, Phone (E.164 format)',
      'Toggle Marketing Consent and Loyalty Enrollment as desired',
      'Click "Create Customer"',
    ],
    expectedResult:
      'API POST /customers/createAccount is called. The payload carries: store_id (from session, derived from the JWT custom claim), Preferred_Locale__c (mapped from the selected Country — e.g. France → fr_FR), FirstName, LastName, PersonEmail, Phone in E.164, marketingConsent__c, LoyaltyRequest__c, and any filled children slots. Success response returns the new Account Id. User is redirected to the profile page.',
    priority: 'Critical',
    dataSource: 'real-api',
    dataSourceNote: 'POST /customers/createAccount — store_id links to Store__c; Preferred_Locale__c via localeFromCountry() in src/lib/api-transforms.ts.',
  },
  {
    id: 'CREATE-02',
    area: 'Customer Creation',
    title: 'Create customer — duplicate email check',
    preconditions: 'A customer with email "test@example.com" already exists in Salesforce',
    steps: [
      'Navigate to /customers/new',
      'Enter the existing email "test@example.com"',
      'Attempt to submit the form',
    ],
    expectedResult:
      'The app calls checkEmailExists first. If the customer exists, a warning is shown before creating a duplicate.',
    priority: 'High',
    dataSource: 'real-api',
    dataSourceNote: 'GET /customers/checkEmailExists then GET /customers/getAccount',
  },
  {
    id: 'CREATE-03',
    area: 'Customer Creation',
    title: 'Create customer — phone number validation',
    preconditions: 'User is logged in',
    steps: [
      'Navigate to /customers/new',
      'Enter an invalid phone number (e.g. "12345" without country code)',
      'Attempt to submit',
    ],
    expectedResult:
      'Validation error is shown. Phone must be in E.164 format (e.g. +393331234567).',
    priority: 'High',
    dataSource: 'frontend-only',
    dataSourceNote: 'Client-side validation, no API call made',
  },
  {
    id: 'CREATE-04',
    area: 'Customer Creation',
    title: 'Create customer — phone uniqueness check',
    preconditions: 'User is logged in',
    steps: [
      'Navigate to /customers/new',
      'Enter a phone number (E.164 format)',
      'Wait for the debounced validation (500ms)',
    ],
    expectedResult:
      'Phone uniqueness is checked against the real Salesforce backend via checkPhoneExists. A warning appears if the phone is already registered, showing the existing customer details.',
    priority: 'High',
    dataSource: 'real-api',
    dataSourceNote: 'GET /customers/checkPhoneExists — real API endpoint. If duplicate found, also calls GET /customers/search to show existing customer info.',
  },

  // --- Customer Profile ---
  {
    id: 'PROFILE-01',
    area: 'Customer Profile',
    title: 'View customer profile',
    preconditions: 'User is logged in. A customer exists in Salesforce.',
    steps: [
      'Search for the customer and click on the result',
      'Or navigate directly to /customers/{email}',
    ],
    expectedResult:
      'Profile page shows: First Name, Last Name, Email, Phone, Birthdate, Gender, Marketing Consent, Loyalty Consent, Loyalty Tier, Total Points. Data comes from GET /customers/getAccount.',
    priority: 'Critical',
    dataSource: 'real-api',
    dataSourceNote: 'GET /customers/getAccount — reads from Salesforce',
  },
  {
    id: 'PROFILE-02',
    area: 'Customer Profile',
    title: 'View customer profile — non-existent email',
    preconditions: 'User is logged in',
    steps: [
      'Navigate to /customers/nonexistent@test.com',
    ],
    expectedResult:
      'A 404 error is handled gracefully. An appropriate message is shown (e.g. "Customer not found").',
    priority: 'High',
    dataSource: 'real-api',
    dataSourceNote: 'GET /customers/getAccount returns 404',
  },
  {
    id: 'PROFILE-03',
    area: 'Customer Profile',
    title: 'Update customer profile via Edit page',
    preconditions: 'User is viewing an existing customer profile',
    steps: [
      'Click "Edit" button on the customer profile',
      'Modify fields (e.g. First Name, Phone, Date of Birth, Address, Children)',
      'Click "Save Changes"',
    ],
    expectedResult:
      'User is navigated to /customers/{email}/edit. API PATCH /customers/updateAccount is called with changed fields plus store_id (session, claim-derived) and Preferred_Locale__c (mapped from Country). Address is sent via ShippingStreet/City/PostalCode/Country and children via figlio1-4. Success response confirms the update. User is redirected back to the profile page with updated values.',
    priority: 'Critical',
    dataSource: 'real-api',
    dataSourceNote: 'PATCH /customers/updateAccount — writes to Salesforce including store_id, Preferred_Locale__c, ShippingStreet, ShippingCity, ShippingPostalCode, ShippingCountry, figlio1-figlio4.',
  },

  // --- Customer Edit ---
  {
    id: 'EDIT-01',
    area: 'Customer Edit',
    title: 'Edit page loads with pre-filled data from API',
    preconditions: 'User is logged in. A customer exists with address and children data.',
    steps: [
      'Navigate to /customers/{email}/edit',
      'Observe the form fields',
    ],
    expectedResult:
      'All fields are pre-filled from GET /customers/getAccount including: name, phone (split into country prefix + number), date of birth, address (ShippingStreet/City/PostalCode/Country), children (figlio1-4), marketing consent, loyalty enrollment.',
    priority: 'High',
    dataSource: 'real-api',
    dataSourceNote: 'GET /customers/getAccount — reads all fields including address and children from Salesforce',
  },
  {
    id: 'EDIT-02',
    area: 'Customer Edit',
    title: 'Save address and children changes',
    preconditions: 'User is on the edit page for an existing customer',
    steps: [
      'Modify the street address, city, postal code, and country',
      'Add or modify a child (name, birth date, gender, height, shoe size)',
      'Click "Save Changes"',
    ],
    expectedResult:
      'PATCH /customers/updateAccount sends ShippingStreet, ShippingCity, ShippingPostalCode, ShippingCountry, figlio1-4, store_id and Preferred_Locale__c (mapped from Country). Success message is shown and user is redirected to the profile page.',
    priority: 'High',
    dataSource: 'real-api',
    dataSourceNote: 'PATCH /customers/updateAccount — address, children, store_id and locale supported in API v0.0.8',
  },

  // --- Loyalty Ledger ---
  {
    id: 'LEDGER-01',
    area: 'Loyalty Ledger',
    title: 'View loyalty points ledger for a customer',
    preconditions: 'User is viewing a customer profile. The customer has loyalty transactions.',
    steps: [
      'Navigate to a customer profile that has loyalty activity',
      'Look for the loyalty points / transaction history section',
    ],
    expectedResult:
      'Ledger entries are displayed showing: Applied Rules, Points, Qualifying Date, Status, Transaction Number. Data from GET /customers/getLoyaltyLedger.',
    priority: 'High',
    dataSource: 'real-api',
    dataSourceNote: 'GET /customers/getLoyaltyLedger — reads from Salesforce',
  },
  {
    id: 'LEDGER-02',
    area: 'Loyalty Ledger',
    title: 'Loyalty ledger for customer with no transactions',
    preconditions: 'User is viewing a newly created customer profile with no loyalty activity',
    steps: [
      'Navigate to a new customer profile',
    ],
    expectedResult:
      'An empty state message is shown (e.g. "No loyalty transactions yet") or the section gracefully handles a 404 from the API.',
    priority: 'Medium',
    dataSource: 'real-api',
    dataSourceNote: 'GET /customers/getLoyaltyLedger returns 404 or empty records',
  },

  // --- Dashboard ---
  {
    id: 'DASH-01',
    area: 'Dashboard',
    title: 'Dashboard loads with This Week + Last Week KPI cards',
    preconditions: 'User is logged in',
    steps: [
      'Navigate to / (Dashboard)',
      'Wait for the segment calls to resolve',
    ],
    expectedResult:
      'Dashboard shows exactly two KPI cards: This Week and Last Week. The numbers match the length of the arrays returned by the two segment endpoints for the session store. No other KPIs render (Today/Last Month/Total Enrollments/Marketing Consent Rate were removed because no BE endpoint exists for them).',
    priority: 'Critical',
    dataSource: 'real-api',
    dataSourceNote: 'GET /customers/created-this-week?store_id= and GET /customers/created-last-week?store_id= — both scoped to session.storeId.',
  },
  {
    id: 'DASH-02',
    area: 'Dashboard',
    title: 'This Week table is populated from real BE data',
    preconditions: 'User is logged in. At least one customer was created this week in the scoped store.',
    steps: [
      'Navigate to / (Dashboard)',
      'Look at the "This Week" table',
    ],
    expectedResult:
      'Table lists customers with Name, Email, Date, Rank badge (LoyaltyTier__c), Loyalty indicator (LoyaltyConsent__c), and a View button. Clicking View navigates to /customers/{email} and loads the profile from Salesforce.',
    priority: 'Critical',
    dataSource: 'real-api',
    dataSourceNote: 'GET /customers/created-this-week?store_id= returns CustomerSegmentRecord[]. Ordered by CreatedDate DESC.',
  },
  {
    id: 'DASH-03',
    area: 'Dashboard',
    title: 'Last Week table is populated from real BE data',
    preconditions: 'User is logged in. At least one customer was created last week in the scoped store.',
    steps: [
      'Navigate to / (Dashboard)',
      'Look at the "Last Week" table (appears below This Week)',
    ],
    expectedResult:
      'Table lists last-week customers with the same columns as This Week. Rank and loyalty indicator reflect the values returned by the BE.',
    priority: 'Critical',
    dataSource: 'real-api',
    dataSourceNote: 'GET /customers/created-last-week?store_id= returns CustomerSegmentRecord[]. Ordered by CreatedDate DESC.',
  },
  {
    id: 'DASH-04',
    area: 'Dashboard',
    title: 'Dashboard empty state when no customers in a segment',
    preconditions: 'No customers were created this (or last) week in the scoped store',
    steps: [
      'Navigate to / (Dashboard)',
    ],
    expectedResult:
      'The affected KPI card shows 0. The affected table shows a "No customers." message instead of a row list. The other table/KPI is unaffected.',
    priority: 'Medium',
    dataSource: 'real-api',
    dataSourceNote: 'BE returns an empty array; UI shows the empty state.',
  },
  {
    id: 'DASH-05',
    area: 'Dashboard',
    title: 'End-to-end: create customer, reload dashboard, see it in This Week',
    preconditions: 'User is logged in. The current store_id on the session matches a real Store__c record.',
    steps: [
      'Click "+ New Customer", complete registration with a unique email',
      'After redirect to the new profile, navigate back to /',
      'Observe the This Week KPI and table',
    ],
    expectedResult:
      'The newly-created customer appears at the top of the This Week table and the This Week KPI count incremented by one. This confirms that store_id is being written on create and the segment endpoint reads it back correctly.',
    priority: 'Critical',
    dataSource: 'real-api',
    dataSourceNote: 'POST /customers/createAccount (with store_id) → GET /customers/created-this-week?store_id=',
  },
  {
    id: 'DASH-06',
    area: 'Dashboard',
    title: 'Segment endpoints use the session store_id',
    preconditions: 'User is logged in',
    steps: [
      'Open DevTools → Network',
      'Navigate to / (Dashboard)',
      'Find the two GET requests to created-this-week and created-last-week',
    ],
    expectedResult:
      'Both requests include the same ?store_id= query parameter, matching session.storeId in localStorage. That value was derived from the Firebase custom claim on the authenticated user. Both return 200 with JSON arrays.',
    priority: 'High',
    dataSource: 'real-api',
    dataSourceNote: 'Segment endpoints are store-scoped; wrong or missing store_id returns 404.',
  },

  // --- Stores ---
  {
    id: 'STORE-01',
    area: 'Stores',
    title: 'Login resolves the real store Name from /stores/getStores',
    preconditions: 'Fresh login (no cached session) with a user that has a valid store_id claim',
    steps: [
      'Clear localStorage',
      'Log in',
      'Open DevTools → Network and filter by "getStores"',
      'Inspect the request and the resulting session in Local Storage',
    ],
    expectedResult:
      'A single GET /stores/getStores request fires during login. Among the StoreRecord array, the one with Id matching the claim store_id has its Name copied into session.storeName, and "Store #<Store_No__c> · <Country__c>" is stored in session.storeAddress. These power the header and the CustomerNew / CustomerEdit store panels.',
    priority: 'High',
    dataSource: 'real-api',
    dataSourceNote: 'GET /stores/getStores (no country filter) — called once per login in fetchStoreDetails() (src/lib/auth.tsx).',
  },
  {
    id: 'STORE-02',
    area: 'Stores',
    title: 'getStores failure degrades gracefully',
    preconditions: 'Simulate a BE failure (e.g. block the endpoint in DevTools → Network → Block request URL)',
    steps: [
      'Clear localStorage',
      'Block /stores/getStores in DevTools',
      'Log in',
    ],
    expectedResult:
      'Login still succeeds. Header shows "Store" as a fallback; Location is empty; a console.warn "[auth] Failed to fetch store details" is logged. store_id (from the JWT claim) is still populated, so the Dashboard segment endpoints keep working.',
    priority: 'Medium',
    dataSource: 'real-api',
    dataSourceNote: 'Defensive fallback path in fetchStoreDetails() — prevents a transient /stores failure from bricking login.',
  },

  // --- Cross-cutting ---
  {
    id: 'CROSS-01',
    area: 'Cross-cutting',
    title: 'API error handling — network failure',
    preconditions: 'User is logged in',
    steps: [
      'Disconnect from the network (airplane mode or DevTools offline)',
      'Perform a search or navigate to a customer profile',
    ],
    expectedResult:
      'An error message is displayed. The app does not crash. User can retry after reconnecting.',
    priority: 'High',
    dataSource: 'real-api',
    dataSourceNote: 'Tests real API error handling path',
  },
  {
    id: 'CROSS-02',
    area: 'Cross-cutting',
    title: 'Responsive design — mobile view',
    preconditions: 'User is logged in',
    steps: [
      'Open the app on a mobile device or resize the browser to < 1024px',
      'Use the search bar',
      'Navigate to a customer profile',
    ],
    expectedResult:
      'Layout adapts to mobile: grid layout in header, search bar spans full width, dropdown is usable on small screens.',
    priority: 'Medium',
    dataSource: 'frontend-only',
    dataSourceNote: 'UI/CSS only, no data dependency',
  },
  {
    id: 'CROSS-03',
    area: 'Cross-cutting',
    title: 'End-to-end: Create customer then find via search',
    preconditions: 'User is logged in',
    steps: [
      'Create a new customer via /customers/new with a unique name',
      'Go back to the Dashboard',
      'Search for the newly created customer by name in the search bar',
      'Click on the result to open their profile',
    ],
    expectedResult:
      'The new customer appears in search results. Clicking it opens the profile with all the data that was just entered. This confirms create + search + getAccount all work end-to-end with real data.',
    priority: 'Critical',
    dataSource: 'real-api',
    dataSourceNote: 'POST /customers/createAccount + GET /customers/search + GET /customers/getAccount',
  },
];

const priorityColors = {
  Critical: 'bg-red-100 text-red-800 border-red-200',
  High: 'bg-orange-100 text-orange-800 border-orange-200',
  Medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
};

const dataSourceStyles: Record<DataSource, { label: string; className: string }> = {
  'real-api': { label: 'Real API', className: 'bg-green-100 text-green-800 border-green-300' },
  mock: { label: 'Mock Data', className: 'bg-red-100 text-red-800 border-red-300' },
  'frontend-only': { label: 'Frontend Only', className: 'bg-gray-100 text-gray-700 border-gray-300' },
};

const areaColors: Record<string, string> = {
  Authentication: 'bg-purple-50 border-purple-200',
  'Customer Search': 'bg-blue-50 border-blue-200',
  'Customer Creation': 'bg-green-50 border-green-200',
  'Customer Profile': 'bg-indigo-50 border-indigo-200',
  'Customer Edit': 'bg-cyan-50 border-cyan-200',
  'Loyalty Ledger': 'bg-amber-50 border-amber-200',
  Dashboard: 'bg-teal-50 border-teal-200',
  Stores: 'bg-lime-50 border-lime-200',
  'Cross-cutting': 'bg-gray-50 border-gray-200',
};

export function UAT() {
  const navigate = useNavigate();

  const areas = [...new Set(uatCases.map((c) => c.area))];

  const summary = {
    total: uatCases.length,
    critical: uatCases.filter((c) => c.priority === 'Critical').length,
    high: uatCases.filter((c) => c.priority === 'High').length,
    medium: uatCases.filter((c) => c.priority === 'Medium').length,
  };

  const dataSourceCounts = {
    'real-api': uatCases.filter((c) => c.dataSource === 'real-api').length,
    mock: uatCases.filter((c) => c.dataSource === 'mock').length,
    'frontend-only': uatCases.filter((c) => c.dataSource === 'frontend-only').length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Page Title */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">UAT Test Plan</h1>
            <p className="text-sm text-gray-600 mt-1">
              Monnalisa Retail App — End-to-End User Acceptance Tests (API v0.0.8)
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate('/')}>
            Back to Dashboard
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border p-4 text-center">
            <p className="text-3xl font-bold text-gray-900">{summary.total}</p>
            <p className="text-xs text-gray-500 mt-1">Total Tests</p>
          </div>
          <div className="bg-white rounded-lg border p-4 text-center">
            <p className="text-3xl font-bold text-red-600">{summary.critical}</p>
            <p className="text-xs text-gray-500 mt-1">Critical</p>
          </div>
          <div className="bg-white rounded-lg border p-4 text-center">
            <p className="text-3xl font-bold text-orange-600">{summary.high}</p>
            <p className="text-xs text-gray-500 mt-1">High</p>
          </div>
          <div className="bg-white rounded-lg border p-4 text-center">
            <p className="text-3xl font-bold text-yellow-600">{summary.medium}</p>
            <p className="text-xs text-gray-500 mt-1">Medium</p>
          </div>
        </div>

        {/* Data Source Legend */}
        <div className="bg-white rounded-lg border mb-6 p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Data Source Breakdown</h2>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <span className="inline-block px-2 py-0.5 rounded border text-xs font-medium bg-green-100 text-green-800 border-green-300">
                Real API
              </span>
              <span className="text-sm text-gray-700">
                {dataSourceCounts['real-api']} tests — data from real Salesforce BFF backend
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block px-2 py-0.5 rounded border text-xs font-medium bg-red-100 text-red-800 border-red-300">
                Mock Data
              </span>
              <span className="text-sm text-gray-700">
                {dataSourceCounts.mock} tests — data from MSW browser mocks (fake, local-only)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block px-2 py-0.5 rounded border text-xs font-medium bg-gray-100 text-gray-700 border-gray-300">
                Frontend Only
              </span>
              <span className="text-sm text-gray-700">
                {dataSourceCounts['frontend-only']} tests — UI logic only, no data dependency
              </span>
            </div>
          </div>
        </div>

        {/* v0.0.8 Changes */}
        <div className="bg-green-50 border border-green-200 rounded-lg mb-6 p-4">
          <h2 className="text-sm font-semibold text-green-800 mb-2">API v0.0.8 — What's Newly Integrated</h2>
          <ul className="text-sm text-green-800 list-disc list-inside space-y-1">
            <li>
              <strong>User &rarr; Store mapping</strong> is now resolved via Firebase custom claims. The ID token's payload carries <code className="bg-green-100 px-1 rounded">{'{"store_id":"..."}'}</code>; the frontend decodes it on login and on every token refresh.
            </li>
            <li>
              <strong>Real store Name and Location</strong> are fetched via <code className="bg-green-100 px-1 rounded">GET /stores/getStores</code> during login, matched by the claim's store_id. They populate <code className="bg-green-100 px-1 rounded">session.storeName</code> (header bar) and <code className="bg-green-100 px-1 rounded">session.storeAddress</code> (CustomerNew/Edit store panel). Sales Associate now shows the manager's email instead of a Firebase UID.
            </li>
            <li>
              <strong>Dashboard This Week / Last Week KPIs and tables</strong> pulled from{' '}
              <code className="bg-green-100 px-1 rounded">GET /customers/created-this-week?store_id=</code> and{' '}
              <code className="bg-green-100 px-1 rounded">GET /customers/created-last-week?store_id=</code>. All other mock-backed dashboard sections were removed from the UI.
            </li>
            <li>
              <strong>store_id</strong> is sent on{' '}
              <code className="bg-green-100 px-1 rounded">POST /customers/createAccount</code> and{' '}
              <code className="bg-green-100 px-1 rounded">PATCH /customers/updateAccount</code>, tagging accounts to the current Store__c record.
            </li>
            <li>
              <strong>Preferred_Locale__c</strong> is now derived from the customer's Country field on the form (Italy &rarr; it_IT, France &rarr; fr_FR, etc.) via <code className="bg-green-100 px-1 rounded">localeFromCountry()</code>. Previously hardcoded to <code className="bg-green-100 px-1 rounded">it_IT</code>.
            </li>
          </ul>
        </div>

        {/* API Data Gaps — Backend Requests */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg mb-6 p-4">
          <h2 className="text-sm font-semibold text-amber-800 mb-2">API Data Gaps &mdash; Backend Team Action Required</h2>
          <p className="text-xs text-amber-700 mb-3">
            These capabilities are either shown/needed in the frontend but have no corresponding API support, or are currently worked around with a hardcode.
          </p>
          <div className="space-y-3 text-sm text-amber-900">
            <div className="bg-white border border-green-200 rounded p-3">
              <p className="font-semibold text-green-800">User &rarr; Store mapping &mdash; RESOLVED</p>
              <p className="text-xs text-green-700 mt-1">
                BE sets a Firebase custom claim on each user containing <code className="bg-green-100 px-1 rounded">{'{"store_id":"..."}'}</code>. The frontend decodes the idToken JWT payload on login and on token refresh (<code className="bg-green-100 px-1 rounded">extractStoreIdFromToken()</code>), then calls <code className="bg-green-100 px-1 rounded">storeApi.getStores</code> to resolve the matching Salesforce Store Name and Country into the session. Header and register/edit store panels render the real values. Fallback store_id with a console warning if the claim is missing.
              </p>
            </div>
            <div className="bg-white border border-amber-200 rounded p-3">
              <p className="font-semibold">Purchase History</p>
              <p className="text-xs text-amber-700 mt-1">
                Confirmed unavailable by BE: "non posso recuperare dal BFF senza analisi e coinvolgimento del team CRM". No purchases field, no endpoint. "Previous Purchases" placeholder on the Profile page remains inert.
              </p>
            </div>
            <div className="bg-white border border-amber-200 rounded p-3">
              <p className="font-semibold">Coupons &amp; Consumables</p>
              <p className="text-xs text-amber-700 mt-1">
                <strong>Not in scope for this release.</strong> The Profile page does not display coupons or consumables. Rewards activity IS real &mdash; it's driven by <code className="bg-amber-100 px-1 rounded">GET /customers/getLoyaltyLedger</code> (Loyalty Point Ledger records).
              </p>
            </div>
            <div className="bg-white border border-amber-200 rounded p-3">
              <p className="font-semibold">Aggregate stats (historical windows beyond this/last week)</p>
              <p className="text-xs text-amber-700 mt-1">
                "Last Month", "Total Enrollments", "Marketing Consent Rate", "Top Customers (12 months)", "Upcoming Birthdays" were removed from the Dashboard — no BE endpoint provides these aggregates today.
              </p>
            </div>
          </div>
        </div>

        {/* Customer Profile — Field-Level Data Source Report */}
        <div className="bg-white rounded-lg border mb-6 p-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Customer Profile &mdash; Field-Level Data Report</h2>
          <p className="text-xs text-gray-500 mb-4">
            What the Customer Profile and Edit pages display vs what the API actually provides via <code className="bg-gray-100 px-1 rounded">GET /customers/getAccount</code> (v0.0.8).
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-2 px-3 font-medium text-gray-600">Field</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-600">Profile Page</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-600">Edit Page</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-600">API Read</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-600">API Write</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="text-gray-700">
                {[
                  { field: 'First Name', profile: true, edit: true, read: 'FirstName', write: 'FirstName', status: 'ok' },
                  { field: 'Last Name', profile: true, edit: true, read: 'LastName', write: 'LastName', status: 'ok' },
                  { field: 'Email', profile: true, edit: false, read: 'EmailKey__c', write: 'PersonEmail (create only)', status: 'ok' },
                  { field: 'Phone', profile: true, edit: true, read: 'Phone', write: 'Phone', status: 'ok' },
                  { field: 'Date of Birth', profile: false, edit: true, read: 'PersonBirthdate', write: 'PersonBirthdate', status: 'ok' },
                  { field: 'Gender', profile: false, edit: false, read: 'Gender__c', write: 'Gender__c', status: 'ok' },
                  { field: 'Marketing Consent', profile: false, edit: true, read: 'MarketingConsent__c', write: 'marketingConsent__c', status: 'ok' },
                  { field: 'Loyalty Enrollment', profile: true, edit: true, read: 'LoyaltyConsent__c', write: 'LoyaltyRequest__c', status: 'ok' },
                  { field: 'Loyalty Double Opt-In', profile: true, edit: false, read: 'LoyaltyDoubleOptIn__c', write: null, status: 'ok' },
                  { field: 'Loyalty Tier / Rank', profile: true, edit: false, read: 'LoyaltyTier__c', write: null, status: 'ok' },
                  { field: 'Total Points', profile: true, edit: false, read: 'TotalQualifyingPoints__c', write: null, status: 'ok' },
                  { field: 'Customer Number', profile: false, edit: false, read: 'Customer_no__c', write: null, status: 'ok' },
                  { field: 'Children (figlio1-4)', profile: false, edit: true, read: 'figlio1-figlio4', write: 'figlio1-figlio4', status: 'ok' },
                  { field: 'Address / Street', profile: false, edit: true, read: 'ShippingStreet', write: 'ShippingStreet', status: 'ok' },
                  { field: 'City', profile: false, edit: true, read: 'ShippingCity', write: 'ShippingCity', status: 'ok' },
                  { field: 'Postal Code', profile: false, edit: true, read: 'ShippingPostalCode', write: 'ShippingPostalCode', status: 'ok' },
                  { field: 'Country', profile: false, edit: true, read: 'ShippingCountry', write: 'ShippingCountry', status: 'ok' },
                  { field: 'Preferred Store', profile: false, edit: false, read: 'store (PreferredStoreInfo)', write: 'store_id', status: 'ok' },
                  { field: 'Preferences (style, age, etc)', profile: false, edit: false, read: null, write: null, status: 'removed' },
                  { field: 'Privacy Consent', profile: false, edit: false, read: null, write: null, status: 'removed' },
                  { field: 'Loyalty Ledger / Activity', profile: true, edit: false, read: 'LoyaltyPointLedger records (AppliedRules__c, Points__c, OperationDate__c, Status__c, TransactionNumber__c)', write: null, status: 'ok' },
                  { field: 'Previous Purchases', profile: true, edit: false, read: null, write: null, status: 'gap' },
                ].map((row) => (
                  <tr key={row.field} className={`border-b ${
                    row.status === 'gap' ? 'bg-red-50' : row.status === 'mock' ? 'bg-amber-50' : row.status === 'removed' ? 'bg-gray-50 line-through opacity-60' : ''
                  }`}>
                    <td className="py-2 px-3 font-medium">{row.field}</td>
                    <td className="py-2 px-3">{row.profile ? 'Displayed' : <span className="text-gray-400">--</span>}</td>
                    <td className="py-2 px-3">{row.edit ? 'Editable' : <span className="text-gray-400">--</span>}</td>
                    <td className="py-2 px-3 font-mono text-xs">{row.read ?? <span className="text-red-500 font-sans">Not in API</span>}</td>
                    <td className="py-2 px-3 font-mono text-xs">{row.write ?? <span className="text-red-500 font-sans">Not in API</span>}</td>
                    <td className="py-2 px-3">
                      {row.status === 'ok' && <span className="text-green-600 font-medium text-xs">Real Data</span>}
                      {row.status === 'gap' && <span className="text-red-600 font-medium text-xs">No API Support</span>}
                      {row.status === 'mock' && <span className="text-amber-600 font-medium text-xs">Hardcoded Mock</span>}
                      {row.status === 'removed' && <span className="text-gray-500 font-medium text-xs">Removed</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* API Endpoints Reference */}
        <div className="bg-white rounded-lg border mb-8 p-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">API Endpoints</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium text-gray-600">Method</th>
                  <th className="text-left py-2 pr-4 font-medium text-gray-600">Endpoint</th>
                  <th className="text-left py-2 pr-4 font-medium text-gray-600">Source</th>
                  <th className="text-left py-2 font-medium text-gray-600">Used By</th>
                </tr>
              </thead>
              <tbody className="text-gray-700">
                <tr className="border-b">
                  <td className="py-2 pr-4"><code className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-xs">GET</code></td>
                  <td className="py-2 pr-4 font-mono text-xs">/customers/checkEmailExists?email=</td>
                  <td className="py-2 pr-4"><span className="text-green-600 font-medium text-xs">Real API</span></td>
                  <td className="py-2 text-xs text-gray-500">Customer Creation</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pr-4"><code className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-xs">GET</code></td>
                  <td className="py-2 pr-4 font-mono text-xs">/customers/checkPhoneExists?phone=</td>
                  <td className="py-2 pr-4"><span className="text-green-600 font-medium text-xs">Real API</span></td>
                  <td className="py-2 text-xs text-gray-500">Customer Creation</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pr-4"><code className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-xs">GET</code></td>
                  <td className="py-2 pr-4 font-mono text-xs">/customers/getAccount?email=</td>
                  <td className="py-2 pr-4"><span className="text-green-600 font-medium text-xs">Real API</span></td>
                  <td className="py-2 text-xs text-gray-500">Customer Profile / Edit</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pr-4"><code className="bg-green-100 text-green-800 px-1.5 py-0.5 rounded text-xs">POST</code></td>
                  <td className="py-2 pr-4 font-mono text-xs">/customers/createAccount</td>
                  <td className="py-2 pr-4"><span className="text-green-600 font-medium text-xs">Real API</span></td>
                  <td className="py-2 text-xs text-gray-500">Customer Creation (sends store_id)</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pr-4"><code className="bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded text-xs">PATCH</code></td>
                  <td className="py-2 pr-4 font-mono text-xs">/customers/updateAccount?email=</td>
                  <td className="py-2 pr-4"><span className="text-green-600 font-medium text-xs">Real API</span></td>
                  <td className="py-2 text-xs text-gray-500">Customer Edit (sends store_id)</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pr-4"><code className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-xs">GET</code></td>
                  <td className="py-2 pr-4 font-mono text-xs">/customers/getLoyaltyLedger?email=</td>
                  <td className="py-2 pr-4"><span className="text-green-600 font-medium text-xs">Real API</span></td>
                  <td className="py-2 text-xs text-gray-500">Customer Profile</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pr-4"><code className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-xs">GET</code></td>
                  <td className="py-2 pr-4 font-mono text-xs">/customers/search?q=&limit=</td>
                  <td className="py-2 pr-4"><span className="text-green-600 font-medium text-xs">Real API</span></td>
                  <td className="py-2 text-xs text-gray-500">Header Search</td>
                </tr>
                <tr className="border-b bg-green-50">
                  <td className="py-2 pr-4"><code className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-xs">GET</code></td>
                  <td className="py-2 pr-4 font-mono text-xs">/customers/created-this-week?store_id=</td>
                  <td className="py-2 pr-4"><span className="text-green-600 font-medium text-xs">Real API (new v0.0.8)</span></td>
                  <td className="py-2 text-xs text-gray-500">Dashboard — This Week</td>
                </tr>
                <tr className="border-b bg-green-50">
                  <td className="py-2 pr-4"><code className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-xs">GET</code></td>
                  <td className="py-2 pr-4 font-mono text-xs">/customers/created-last-week?store_id=</td>
                  <td className="py-2 pr-4"><span className="text-green-600 font-medium text-xs">Real API (new v0.0.8)</span></td>
                  <td className="py-2 text-xs text-gray-500">Dashboard — Last Week</td>
                </tr>
                <tr className="border-b bg-green-50">
                  <td className="py-2 pr-4"><code className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-xs">GET</code></td>
                  <td className="py-2 pr-4 font-mono text-xs">/stores/getStores?country=</td>
                  <td className="py-2 pr-4"><span className="text-green-600 font-medium text-xs">Real API (new v0.0.8)</span></td>
                  <td className="py-2 text-xs text-gray-500">Login flow — resolves store Name & Address</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Real API: monnalisa-mid-prd-api-cfg-v0-0-8 | Auth: Firebase Bearer Token | MSW Mocks: disabled on Dashboard (no remaining mocked endpoints consumed by the app)
          </p>
        </div>

        {/* Compact Test Cases — Collapsible by Area */}
        <div className="bg-white rounded-lg border mb-8 p-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Test Cases</h2>
          <div className="space-y-2">
            {areas.map((area) => {
              const areaCases = uatCases.filter((c) => c.area === area);
              return (
                <details key={area} className={`rounded-lg border overflow-hidden ${areaColors[area] ?? 'bg-white border-gray-200'}`}>
                  <summary className="cursor-pointer px-4 py-3 flex items-center justify-between select-none hover:opacity-80">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-gray-900 text-sm">{area}</h3>
                      <span className="text-xs text-gray-500">{areaCases.length} tests</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {areaCases.some((c) => c.priority === 'Critical') && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border bg-red-100 text-red-800 border-red-200">
                          {areaCases.filter((c) => c.priority === 'Critical').length} Critical
                        </span>
                      )}
                      {areaCases.some((c) => c.dataSource === 'real-api') && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border bg-green-100 text-green-800 border-green-300">
                          {areaCases.filter((c) => c.dataSource === 'real-api').length} Real API
                        </span>
                      )}
                      {areaCases.some((c) => c.dataSource === 'mock') && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border bg-red-100 text-red-800 border-red-300">
                          {areaCases.filter((c) => c.dataSource === 'mock').length} Mock
                        </span>
                      )}
                    </div>
                  </summary>
                  <div className="border-t">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50/50">
                          <th className="text-left py-1.5 px-3 font-medium text-gray-500 w-20">ID</th>
                          <th className="text-left py-1.5 px-3 font-medium text-gray-500">Test</th>
                          <th className="text-left py-1.5 px-3 font-medium text-gray-500 w-20">Source</th>
                          <th className="text-left py-1.5 px-3 font-medium text-gray-500 w-16">Priority</th>
                        </tr>
                      </thead>
                      <tbody>
                        {areaCases.map((tc) => {
                          const ds = dataSourceStyles[tc.dataSource];
                          return (
                            <tr key={tc.id} className="border-t border-gray-100">
                              <td className="py-1.5 px-3 font-mono text-gray-400">{tc.id}</td>
                              <td className="py-1.5 px-3">
                                <details className="group">
                                  <summary className="cursor-pointer text-gray-900 font-medium hover:text-gray-600 select-none list-none flex items-center gap-1">
                                    <svg className="w-3 h-3 text-gray-400 transition-transform group-open:rotate-90 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                    </svg>
                                    {tc.title}
                                  </summary>
                                  <div className="mt-1.5 ml-4 space-y-1 text-gray-600 pb-1">
                                    {tc.dataSourceNote && (
                                      <p className={`text-[10px] px-1.5 py-0.5 rounded inline-block ${
                                        tc.dataSource === 'mock' ? 'bg-red-50 text-red-600' : tc.dataSource === 'real-api' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'
                                      }`}>{tc.dataSourceNote}</p>
                                    )}
                                    <p><span className="text-gray-400">Pre: </span>{tc.preconditions}</p>
                                    <ol className="list-decimal list-inside space-y-0.5 text-gray-700">
                                      {tc.steps.map((step, i) => <li key={i}>{step}</li>)}
                                    </ol>
                                    <p><span className="text-gray-400">Expected: </span>{tc.expectedResult}</p>
                                  </div>
                                </details>
                              </td>
                              <td className="py-1.5 px-3">
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border whitespace-nowrap ${ds.className}`}>
                                  {ds.label}
                                </span>
                              </td>
                              <td className="py-1.5 px-3">
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border whitespace-nowrap ${priorityColors[tc.priority]}`}>
                                  {tc.priority}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </details>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t pt-4 mt-8 text-xs text-gray-500">
          <p>
            Generated for internal UAT testing and customer team sharing.
            Page accessible at <code className="bg-gray-100 px-1 rounded">/uat</code> (requires login).
          </p>
        </div>
      </div>
    </div>
  );
}
