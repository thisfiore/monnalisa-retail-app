# Monnalisa Loyalty App - Frontend/Backend API Integration Review

**Date**: 2026-01-26
**Frontend**: React App (Vite + TypeScript)
**Backend**: BFF on GCP + Salesforce CRM
**API Version**: v0.0.1

---

## 1. Field Name Mapping

### Customer Fields

| Frontend Field | Backend Field (Salesforce) | Transform Required |
|----------------|---------------------------|-------------------|
| `firstName` | `FirstName` | Capitalize first letter |
| `lastName` | `LastName` | Capitalize first letter |
| `email` | `PersonEmail` (create) | None |
| `email` | `EmailKey__c` (read) | Map from response |
| `phone` | `Phone` | Remove spaces, E.164 format |
| `dateOfBirth` | `PersonBirthdate` | Add `T00:00:00.000Z` |
| `loyaltyEnrollment` | `LoyaltyConsent__c` | Rename |
| `marketingConsent` | `marketingConsent__c` | Rename (lowercase m) |

### Missing in Frontend (Need to Add)

| Backend Field | Description | Required? |
|---------------|-------------|-----------|
| `Preferred_Locale__c` | Locale code (e.g., `it_IT`) | Yes (on create) |
| `Gender__c` | Customer gender: `Male` / `Female` | No |

---

## 2. Children Structure - MAJOR DIFFERENCE

### Current Frontend Structure
```json
{
  "children": [
    { "name": "Mario", "birthDate": "2015-06-15", "gender": "male" },
    { "name": "Luisa", "birthDate": "2018-09-20", "gender": "female" }
  ]
}
```

### Required Backend Structure
```json
{
  "figlio1": {
    "nome__c": "Mario",
    "data_di_nascita__c": "2015-06-15",
    "sesso__c": "Male",
    "altezza__c": "120",
    "numero_calzature__c": "30"
  },
  "figlio2": {
    "nome__c": "Luisa",
    "data_di_nascita__c": "2018-09-20",
    "sesso__c": "Female",
    "altezza__c": "110",
    "numero_calzature__c": "28"
  },
  "figlio3": null,
  "figlio4": null
}
```

### Changes Required in Frontend

1. **Limit to 4 children maximum**
2. **Add new fields per child**:
   - Height (`altezza__c`) - in cm
   - Shoe size (`numero_calzature__c`)
3. **Remove "other" gender option** - only Male/Female allowed
4. **Map gender values**: `male` -> `Male`, `female` -> `Female`

---

## 3. Data Format Requirements

### Phone Number
```
Frontend Input:  +39 123 456 7890
Backend Expects: +393331231231
Transform: Remove all spaces and non-digit characters (except leading +)
```

### Date of Birth
```
Frontend Input:  2000-12-25
Backend Expects: 2000-12-25T00:00:00.000Z
Transform: Append T00:00:00.000Z
```

### Child Birth Date
```
Frontend Input:  2015-06-15
Backend Expects: 2015-06-15
Transform: None (YYYY-MM-DD format is correct)
```

---

## 4. API Endpoint Mapping

| Frontend Action | Current Mock Endpoint | Backend Endpoint |
|-----------------|----------------------|------------------|
| Check email exists | `GET /api/customers/check-email?email=` | `GET /customers/checkExists?email=` |
| Get customer | `GET /api/customers/:id` | `GET /customers/getAccount?email=` |
| Create customer | `POST /api/customers` | `POST /customers/createAccount` |
| Update customer | `PUT /api/customers/:id` | `PATCH /customers/updateAccount?email=` |
| Get points history | N/A | `GET /customers/getLoyaltyLedger?email=` |
| Login | `POST /api/auth/login` | **Firebase SDK** (not REST) |

**Important**: Backend uses **email** as the primary lookup key, not customer ID.

---

## 5. Missing Backend Endpoints

The following features exist in frontend but have no backend endpoint:

| Feature | Frontend Endpoint | Status |
|---------|------------------|--------|
| Dashboard statistics | `GET /api/stats` | **NOT PROVIDED** |
| Customer search | `GET /api/customers/search?q=` | **NOT PROVIDED** |
| Phone uniqueness check | `GET /api/customers/check-phone?phone=` | **NOT PROVIDED** |
| Purchase history | `GET /api/customers/:id/purchases` | **NOT PROVIDED** |
| Rewards catalog | N/A | **NOT PROVIDED** |

### Questions for Backend Team

1. **Dashboard Stats**: How can we retrieve:
   - Customers registered today/this week/this month?
   - Total loyalty enrollments count?
   - Marketing consent rate?

2. **Customer Search**: How do store managers search for existing customers by name or phone?

3. **Phone Validation**: How to check if a phone number already exists before registration?

4. **Purchase History**: Will this be available? From Salesforce or another system?

5. **Rewards/Coupons**: Are these planned for a future API version?

---

## 6. Loyalty System Mapping

### Points & Tier

| Frontend Field | Backend Field | Notes |
|----------------|---------------|-------|
| `rank` | `LoyaltyTier__c` | Values: Bronze, Silver, Gold, Platinum |
| `totalPoints` | `TotalQualifyingPoints__c` | Total accumulated points |
| `pendingPoints` | N/A | Calculate from ledger where `Status__c = 'Pending'`? |

### Ledger Entry Fields

| Backend Field | Description |
|---------------|-------------|
| `Points__c` | Points amount (can be negative) |
| `QualifyingDate__c` | Date of transaction |
| `Status__c` | `Confirmed` or `Pending`? |
| `AppliedRules__c` | Rule that awarded points (e.g., "LookCapsule") |
| `TransactionNumber__c` | Reference to transaction |

---

## 7. Authentication Flow

### Current Frontend (Mock)
```
POST /api/auth/login { email, password }
→ Returns session with token
```

### Required Flow (Firebase)
```
1. Initialize Firebase SDK with project config
2. signInWithEmailAndPassword(email, password)
3. Get idToken from Firebase user
4. Include idToken as Bearer token in all API requests
```

### Authorization Header
```
Authorization: Bearer <firebase-id-token>
```

---

## 8. Request/Response Examples

### Create Customer Request

**Frontend Sends** (after transformation):
```json
{
  "FirstName": "Mario",
  "LastName": "Rossi",
  "PersonEmail": "mario.rossi@example.com",
  "Phone": "+393331234567",
  "PersonBirthdate": "1990-05-15T00:00:00.000Z",
  "Gender__c": "Male",
  "marketingConsent__c": true,
  "LoyaltyConsent__c": true,
  "Preferred_Locale__c": "it_IT",
  "figlio1": {
    "nome__c": "Luca",
    "data_di_nascita__c": "2015-03-20",
    "sesso__c": "Male",
    "altezza__c": "120",
    "numero_calzature__c": "32"
  },
  "figlio2": null,
  "figlio3": null,
  "figlio4": null
}
```

**Backend Returns**:
```json
{
  "id": "001MB00000OOMCtYAP",
  "success": true,
  "errors": []
}
```

### Get Customer Response

**Backend Returns**:
```json
{
  "Id": "001MB00000OOMCtYAP",
  "FirstName": "Mario",
  "LastName": "Rossi",
  "EmailKey__c": "mario.rossi@example.com",
  "Phone": "+393331234567",
  "PersonBirthdate": "1990-05-15",
  "Gender__c": "Male",
  "MarketingConsent__c": true,
  "LoyaltyConsent__c": true,
  "LoyaltyTier__c": "Silver",
  "TotalQualifyingPoints__c": 1250
}
```

---

## 9. Required Credentials from Backend Team

### Firebase Configuration
```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

### API Configuration
```env
VITE_API_BASE_URL=https://[api-gateway-url].googleapis.com
```

### Test Account
- Store manager email: `___________`
- Store manager password: `___________`

### CORS
- Please whitelist: `http://localhost:3100`

---

## 10. Action Items Summary

### Frontend Changes Required
- [ ] Add `Preferred_Locale__c` field (dropdown: it_IT, en_US, etc.)
- [ ] Add customer `Gender__c` field (Male/Female)
- [ ] Limit children to maximum 4
- [ ] Add child height and shoe size fields
- [ ] Remove "other" gender option for children
- [ ] Transform phone to E.164 format (strip spaces)
- [ ] Transform dates to ISO 8601 with time
- [ ] Change customer lookup from ID to email
- [ ] Implement Firebase authentication
- [ ] Add Bearer token to all API requests

### Backend Clarifications Needed
- [ ] How to get dashboard statistics?
- [ ] How to search customers?
- [ ] How to validate phone uniqueness?
- [ ] Purchase history endpoint?
- [ ] Customer identifier: use `Id` or `Customer_no__c` for display?

---

## 11. Sample Test Data

### Test Accounts for Store Managers

| Email | Password | Store | Role |
|-------|----------|-------|------|
| `store.milano@monnalisa.com` | `Test123!` | Milano Boutique | Store Manager |
| `store.roma@monnalisa.com` | `Test123!` | Roma Flagship | Store Manager |
| `store.firenze@monnalisa.com` | `Test123!` | Firenze Outlet | Store Manager |

---

### Customer Test Cases

#### Case 1: New Customer - No Children (Minimal Data)
**Scenario**: Basic registration with required fields only

```json
{
  "FirstName": "Giulia",
  "LastName": "Bianchi",
  "PersonEmail": "giulia.bianchi@gmail.com",
  "Phone": "+393201234567",
  "marketingConsent__c": false,
  "LoyaltyConsent__c": true,
  "Preferred_Locale__c": "it_IT"
}
```

**Expected Response**:
```json
{
  "id": "001XXXXXXXXXX001",
  "success": true,
  "errors": []
}
```

---

#### Case 2: New Customer - Full Profile with 1 Child
**Scenario**: Complete registration with all optional fields

```json
{
  "FirstName": "Maria",
  "LastName": "Rossi",
  "PersonEmail": "maria.rossi@outlook.it",
  "Phone": "+393331234567",
  "PersonBirthdate": "1985-03-15T00:00:00.000Z",
  "Gender__c": "Female",
  "marketingConsent__c": true,
  "LoyaltyConsent__c": true,
  "Preferred_Locale__c": "it_IT",
  "figlio1": {
    "nome__c": "Sofia",
    "data_di_nascita__c": "2018-07-22",
    "sesso__c": "Female",
    "altezza__c": "110",
    "numero_calzature__c": "28"
  },
  "figlio2": null,
  "figlio3": null,
  "figlio4": null
}
```

---

#### Case 3: New Customer - Maximum Children (4)
**Scenario**: Family with 4 children, all fields populated

```json
{
  "FirstName": "Alessandro",
  "LastName": "Ferrari",
  "PersonEmail": "alessandro.ferrari@libero.it",
  "Phone": "+393401234567",
  "PersonBirthdate": "1980-11-08T00:00:00.000Z",
  "Gender__c": "Male",
  "marketingConsent__c": true,
  "LoyaltyConsent__c": true,
  "Preferred_Locale__c": "it_IT",
  "figlio1": {
    "nome__c": "Marco",
    "data_di_nascita__c": "2010-02-14",
    "sesso__c": "Male",
    "altezza__c": "145",
    "numero_calzature__c": "36"
  },
  "figlio2": {
    "nome__c": "Elena",
    "data_di_nascita__c": "2012-09-03",
    "sesso__c": "Female",
    "altezza__c": "130",
    "numero_calzature__c": "33"
  },
  "figlio3": {
    "nome__c": "Luca",
    "data_di_nascita__c": "2016-05-20",
    "sesso__c": "Male",
    "altezza__c": "115",
    "numero_calzature__c": "30"
  },
  "figlio4": {
    "nome__c": "Anna",
    "data_di_nascita__c": "2020-12-01",
    "sesso__c": "Female",
    "altezza__c": "95",
    "numero_calzature__c": "24"
  }
}
```

---

#### Case 4: International Customer (Non-Italian)
**Scenario**: Customer from another country with different locale

```json
{
  "FirstName": "Sophie",
  "LastName": "Martin",
  "PersonEmail": "sophie.martin@gmail.com",
  "Phone": "+33612345678",
  "PersonBirthdate": "1990-06-25T00:00:00.000Z",
  "Gender__c": "Female",
  "marketingConsent__c": true,
  "LoyaltyConsent__c": true,
  "Preferred_Locale__c": "fr_FR",
  "figlio1": {
    "nome__c": "Camille",
    "data_di_nascita__c": "2019-04-10",
    "sesso__c": "Female",
    "altezza__c": "100",
    "numero_calzature__c": "26"
  },
  "figlio2": null,
  "figlio3": null,
  "figlio4": null
}
```

---

#### Case 5: Existing Customer - Check Exists
**Scenario**: Email already registered

**Request**: `GET /customers/checkExists?email=maria.rossi@outlook.it`

**Expected Response**:
```json
{
  "exists": true
}
```

**Request**: `GET /customers/checkExists?email=nonexistent@example.com`

**Expected Response**:
```json
{
  "exists": false
}
```

---

#### Case 6: Get Customer Account - Full Response
**Scenario**: Retrieve existing customer with loyalty data

**Request**: `GET /customers/getAccount?email=maria.rossi@outlook.it`

**Expected Response**:
```json
{
  "Id": "001XXXXXXXXXX002",
  "FirstName": "Maria",
  "LastName": "Rossi",
  "EmailKey__c": "maria.rossi@outlook.it",
  "Customer_no__c": "CUST-2024-00123",
  "Phone": "+393331234567",
  "PersonBirthdate": "1985-03-15",
  "Gender__c": "Female",
  "MarketingConsent__c": true,
  "LoyaltyConsent__c": true,
  "LoyaltyConsentDate__c": "2024-06-15T10:30:00.000Z",
  "LoyaltyTier__c": "Silver",
  "TotalQualifyingPoints__c": 1850,
  "LoyaltyDoubleOptIn__c": true
}
```

---

#### Case 7: Update Customer - Add Child
**Scenario**: Existing customer adds a new child

**Request**: `PATCH /customers/updateAccount?email=giulia.bianchi@gmail.com`

```json
{
  "figlio1": {
    "nome__c": "Matteo",
    "data_di_nascita__c": "2022-01-15",
    "sesso__c": "Male",
    "altezza__c": "85",
    "numero_calzature__c": "22"
  }
}
```

**Expected Response**:
```json
{
  "id": "001XXXXXXXXXX001",
  "success": true,
  "errors": []
}
```

---

#### Case 8: Update Customer - Change Consents
**Scenario**: Customer opts out of marketing

**Request**: `PATCH /customers/updateAccount?email=maria.rossi@outlook.it`

```json
{
  "marketingConsent__c": false
}
```

---

### Loyalty Ledger Test Cases

#### Case 9: Get Loyalty Ledger - Multiple Entries
**Scenario**: Customer with transaction history

**Request**: `GET /customers/getLoyaltyLedger?email=maria.rossi@outlook.it&limit=10`

**Expected Response**:
```json
{
  "totalSize": 5,
  "records": [
    {
      "Points__c": 500,
      "QualifyingDate__c": "2025-01-20T14:30:00.000+0000",
      "Status__c": "Confirmed",
      "AppliedRules__c": "WinterCollection",
      "TransactionNumber__c": "ORD-2025-00456"
    },
    {
      "Points__c": 150,
      "QualifyingDate__c": "2025-01-15T11:00:00.000+0000",
      "Status__c": "Pending",
      "AppliedRules__c": "StandardPurchase",
      "TransactionNumber__c": "ORD-2025-00421"
    },
    {
      "Points__c": 400,
      "QualifyingDate__c": "2024-12-20T16:45:00.000+0000",
      "Status__c": "Confirmed",
      "AppliedRules__c": "HolidayBonus",
      "TransactionNumber__c": "ORD-2024-00398"
    },
    {
      "Points__c": -200,
      "QualifyingDate__c": "2024-12-10T09:15:00.000+0000",
      "Status__c": "Confirmed",
      "AppliedRules__c": "RewardRedemption",
      "TransactionNumber__c": "RWD-2024-00012"
    },
    {
      "Points__c": 1000,
      "QualifyingDate__c": "2024-11-25T12:00:00.000+0000",
      "Status__c": "Confirmed",
      "AppliedRules__c": "LookCapsule",
      "TransactionNumber__c": "ORD-2024-00312"
    }
  ]
}
```

---

#### Case 10: Get Loyalty Ledger - New Customer (Empty)
**Scenario**: Customer just enrolled, no transactions yet

**Request**: `GET /customers/getLoyaltyLedger?email=giulia.bianchi@gmail.com`

**Expected Response**:
```json
{
  "totalSize": 0,
  "records": []
}
```

---

### Error Cases

#### Case 11: Create Customer - Duplicate Email
**Scenario**: Attempting to register with existing email

**Request**: `POST /customers/createAccount`
```json
{
  "FirstName": "Another",
  "LastName": "Person",
  "PersonEmail": "maria.rossi@outlook.it",
  "Phone": "+393991234567",
  "marketingConsent__c": false,
  "LoyaltyConsent__c": true,
  "Preferred_Locale__c": "it_IT"
}
```

**Expected Error Response** (HTTP 500):
```json
{
  "status": "error",
  "message": "Account already exists with email: maria.rossi@outlook.it"
}
```

---

#### Case 12: Get Customer - Not Found
**Scenario**: Email not in system

**Request**: `GET /customers/getAccount?email=nonexistent@example.com`

**Expected Error Response** (HTTP 404):
```json
{
  "status": "error",
  "message": "Account not found with email: nonexistent@example.com"
}
```

---

#### Case 13: Invalid Phone Format
**Scenario**: Phone number doesn't match E.164 pattern

**Request**: `POST /customers/createAccount`
```json
{
  "FirstName": "Test",
  "LastName": "User",
  "PersonEmail": "test@example.com",
  "Phone": "123456789",
  "marketingConsent__c": false,
  "LoyaltyConsent__c": true,
  "Preferred_Locale__c": "it_IT"
}
```

**Expected Error Response** (HTTP 422):
```json
{
  "detail": [
    {
      "loc": ["body", "Phone"],
      "msg": "string does not match regex '^\\+[1-9]\\d{1,14}$'",
      "type": "value_error.str.regex"
    }
  ]
}
```

---

#### Case 14: Invalid Birthdate Format
**Scenario**: Date not in expected ISO format

**Request**: `POST /customers/createAccount`
```json
{
  "FirstName": "Test",
  "LastName": "User",
  "PersonEmail": "test2@example.com",
  "Phone": "+393111234567",
  "PersonBirthdate": "25/12/1990",
  "marketingConsent__c": false,
  "LoyaltyConsent__c": true,
  "Preferred_Locale__c": "it_IT"
}
```

**Expected Error Response** (HTTP 422):
```json
{
  "detail": [
    {
      "loc": ["body", "PersonBirthdate"],
      "msg": "string does not match regex",
      "type": "value_error.str.regex"
    }
  ]
}
```

---

### Loyalty Tier Test Data

| Tier | Points Range | Sample Customer |
|------|--------------|-----------------|
| Bronze | 0 - 499 | `giulia.bianchi@gmail.com` (new) |
| Silver | 500 - 1499 | `maria.rossi@outlook.it` (1850 pts) |
| Gold | 1500 - 2999 | `alessandro.ferrari@libero.it` (2500 pts) |
| Platinum | 3000+ | `vip.customer@monnalisa.it` (5200 pts) |

---

### Sample Customers Summary Table

| Email | Name | Children | Tier | Points | Use Case |
|-------|------|----------|------|--------|----------|
| `giulia.bianchi@gmail.com` | Giulia Bianchi | 0 | Bronze | 0 | New minimal registration |
| `maria.rossi@outlook.it` | Maria Rossi | 1 | Silver | 1850 | Standard customer with history |
| `alessandro.ferrari@libero.it` | Alessandro Ferrari | 4 | Gold | 2500 | Large family, high engagement |
| `sophie.martin@gmail.com` | Sophie Martin | 1 | Bronze | 250 | International customer |
| `vip.customer@monnalisa.it` | Elena Conti | 2 | Platinum | 5200 | VIP customer, top tier |
| `duplicate.test@example.com` | Test Duplicate | 0 | - | - | For duplicate email testing |

---

### Child Size Reference (for test data)

| Age | Typical Height (cm) | Typical Shoe Size (EU) |
|-----|---------------------|------------------------|
| 0-1 | 70-80 | 18-20 |
| 1-2 | 80-90 | 20-23 |
| 2-3 | 90-100 | 23-26 |
| 3-4 | 100-105 | 26-28 |
| 4-5 | 105-115 | 28-30 |
| 5-6 | 115-120 | 30-32 |
| 6-8 | 120-130 | 32-34 |
| 8-10 | 130-145 | 34-37 |
| 10-12 | 145-155 | 37-39 |

---

### Locale Codes Reference

| Locale | Country |
|--------|---------|
| `it_IT` | Italy |
| `en_US` | United States |
| `en_GB` | United Kingdom |
| `fr_FR` | France |
| `de_DE` | Germany |
| `es_ES` | Spain |
| `zh_CN` | China |
| `ja_JP` | Japan |
| `ru_RU` | Russia |
| `ar_AE` | UAE (Arabic) |

---

**Document prepared for discussion between Frontend and Backend teams.**
