export type Session = {
  token: string;
  storeId: string;
  storeName: string;
  storeAddress: string;
  salesAssociateId: string;
  salesAssociateName: string;
  email: string;
};

export type Child = {
  name?: string;
  birthDate?: string; // ISO format
  gender?: 'male' | 'female' | 'other';
};

export type CustomerPreferences = {
  gender?: string[];
  style?: string[];
  ageRange?: string[];
  notes?: string;
};

export type Customer = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  children?: Child[];
  loyaltyEnrollment: boolean;
  marketingConsent: boolean;
  privacyConsent: boolean;
  preferences?: CustomerPreferences;
  storeId: string;
  salesAssociateId: string;
  createdAt: string;
  totalPurchases?: number;
  totalSpent?: number;
  rank?: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
};

export type Purchase = {
  id: string;
  customerId: string;
  customerName: string;
  date: string;
  amount: number;
  items: string[];
  storeId: string;
};

export type TopCustomer = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  totalPurchases: number;
  totalSpent: number;
  lastPurchaseDate: string;
  rank: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
  salesAssociateName: string;
};

export type Birthday = {
  id: string;
  name: string;
  type: 'customer' | 'child';
  birthDate: string;
  age: number;
  customerName?: string; // For children, name of the parent
  customerId: string;
};

export type Stats = {
  registeredToday: number;
  registeredThisWeek: number;
  registeredLastWeek: number;
  registeredLastMonth: number;
  totalEnrollments: number;
  marketingConsentRate: number;
  recentCustomers: Customer[];
  lastWeekCustomers: Customer[];
  lastMonthCustomers: Customer[];
  recentPurchases: Purchase[];
  topCustomers: TopCustomer[];
  upcomingBirthdaysThisWeek: Birthday[];
  last12MonthsCustomers: Customer[];
};
