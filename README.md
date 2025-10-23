# Monnalisa Retail Loyalty App - POC

A front-end proof-of-concept for the Monnalisa Loyalty Program retail application. Store assistants can register customers, view stats, and manage loyalty program enrollments.

## Features

### 🔐 Authentication
- Pre-filled demo credentials for instant testing
- Session-based authentication with protected routes

### 📊 Dashboard
- Real-time KPIs:
  - Customers registered today
  - Customers registered this week
  - Total loyalty enrollments
  - Marketing consent rate
- Recent registrations table with customer details
- Quick access to customer profiles

### 👥 Customer Registration
- Comprehensive customer information capture
- **Multiple children support** with name, birth date, and gender
- Consent management (loyalty enrollment + marketing)
- Email validation and duplicate detection
- Auto-captured store context from session

### 🎯 Customer Profile View
- Customer overview with points and rank
- Pending and total points display
- Current loyalty tier (Bronze/Silver/Gold/Platinum)
- Available rewards and coupons
- Children list
- Purchase history
- Activity timeline

## Tech Stack

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Routing**: React Router v6
- **Mock API**: MSW (Mock Service Worker)
- **State Management**: React Context + Hooks

## Setup Instructions

### Prerequisites
- Node.js 18+ and npm

### Installation

1. Navigate to the project directory:
```bash
cd monnalisa-retail-app
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser to:
```
http://localhost:3100
```

## Demo Account

**Pre-filled credentials** (already entered on login page):
- **Email**: `assistant@monnalisa.com`
- **Password**: `password123`
- **Store**: Milano Boutique - Via della Spiga
- **Store ID**: ML-Milano-001
- **Sales Associate ID**: SA-8473

Click "Demo Login" button for instant access!

## Project Structure

```
src/
├── pages/               # Page components
│   ├── Login.tsx        # Login with demo credentials
│   ├── Dashboard.tsx    # KPIs and recent customers
│   ├── CustomerNew.tsx  # Customer registration form
│   └── CustomerProfile.tsx  # Customer profile view
├── components/          # Reusable UI components
│   ├── Input.tsx
│   ├── Button.tsx
│   ├── Card.tsx
│   ├── Toggle.tsx
│   ├── Header.tsx
│   └── ProtectedRoute.tsx
├── lib/                 # Core utilities
│   ├── types.ts         # TypeScript types
│   ├── auth.tsx         # Auth context & hooks
│   └── msw.ts           # Mock API setup
├── App.tsx              # Router configuration
└── main.tsx             # App entry point
```

## Data Models

### Customer
```typescript
{
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  children?: {
    name?: string;
    birthDate?: string;
    gender?: 'male' | 'female' | 'other';
  }[];
  loyaltyEnrollment: boolean;
  marketingConsent: boolean;
  storeId: string;
  salesAssociateId: string;
  createdAt: string;
}
```

## Mock Data

The app includes **30 seeded customers** across the last 14 days with:
- Realistic Italian names
- Random children (40% have at least one child)
- Purchase history
- Loyalty program enrollments
- Activity timeline

## Key Features Demonstrated

### 1. Dynamic Children Array
- Add unlimited children per customer
- Optional fields: name, birth date, gender
- Individual remove buttons per child
- Clean validation (no future dates)

### 2. Form Validation
- Client-side email format validation
- Required field enforcement
- Duplicate email detection (409 conflict)
- Date validation (no future dates)
- Inline error messages

### 3. Store Context
- Auto-captured from authenticated session
- Read-only display on registration form
- Consistent across all customer records

### 4. Customer Profile
- Visual hierarchy with avatar initials
- Points system (total + pending)
- Loyalty tier display
- Children cards with details
- Purchase history
- Activity feed with icons

## API Endpoints (Mocked)

All API calls are intercepted by MSW and served from in-memory data:

- `POST /api/auth/login` - Authentication
- `GET /api/stats` - Dashboard statistics
- `POST /api/customers` - Create new customer
- `GET /api/customers/:id` - Get customer profile (simulated)

## Next Steps for Production

### Backend Integration
- Replace MSW with real REST/GraphQL API
- Implement proper authentication (JWT/OAuth)
- Add server-side validation
- Set up error tracking (Sentry)

### Features
- Customer search and filtering
- Edit customer profiles
- Points management system
- Real rewards catalog
- Multi-store support
- Italian localization (i18n)

### Testing
- Unit tests with Vitest + Testing Library
- E2E tests with Playwright
- Accessibility audits

### Deployment
- Environment variables for API URLs
- Build optimization
- CDN for static assets
- Analytics integration

## Development Commands

```bash
npm run dev      # Start dev server (port 3100)
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

## Notes

- Logo should be placed at `public/monnalisa-logo.jpg` for header display
- Port configured to 3100 in `vite.config.ts`
- MSW runs in browser (no server required)
- All data resets on page refresh (in-memory only)

## License

Proprietary - Monnalisa

---

**Built with ❤️ for Monnalisa Loyalty Program**
