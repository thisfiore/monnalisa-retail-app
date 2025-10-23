import { http, HttpResponse } from 'msw';
import { setupWorker } from 'msw/browser';
import type { Customer, Stats, Purchase, TopCustomer, Birthday } from './types';

// Mock store data
const STORE_DATA = {
  storeId: 'ML-Milano-001',
  storeName: 'Milano Boutique',
  storeAddress: 'Via della Spiga',
  salesAssociateId: 'SA-8473',
};

// Sales associates
const SALES_ASSOCIATES = [
  { id: 'SA-8473', name: 'Ilaria Novelli' },
  { id: 'SA-7621', name: 'Giovanni Bianchi' },
  { id: 'SA-5394', name: 'Francesca Romano' },
  { id: 'SA-9182', name: 'Antonio Ferrari' },
  { id: 'SA-2847', name: 'Valentina Esposito' },
];

const getSalesAssociateName = (id: string): string => {
  const associate = SALES_ASSOCIATES.find(sa => sa.id === id);
  return associate ? associate.name : 'Unknown';
};

// Seed customers
const generateCustomers = (): Customer[] => {
  const customers: Customer[] = [];
  const now = new Date();

  const firstNames = ['Sofia', 'Leonardo', 'Giulia', 'Marco', 'Chiara', 'Alessandro', 'Francesca', 'Matteo', 'Elena', 'Luca'];
  const lastNames = ['Rossi', 'Bianchi', 'Romano', 'Ricci', 'Ferrari', 'Esposito', 'Colombo', 'Russo', 'Greco', 'Bruno'];
  const streets = ['Via Roma', 'Via Milano', 'Via Dante', 'Via Garibaldi', 'Corso Italia', 'Via della Spiga', 'Via Montenapoleone', 'Piazza Duomo'];
  const cities = ['Milano', 'Roma', 'Firenze', 'Venezia', 'Torino', 'Napoli', 'Bologna', 'Verona'];

  for (let i = 0; i < 50; i++) {
    // Spread customers across different time periods
    let daysAgo;
    if (i < 5) {
      // Recent customers (last 7 days)
      daysAgo = Math.floor(Math.random() * 7);
    } else if (i < 15) {
      // Last week customers (8-14 days ago)
      daysAgo = Math.floor(Math.random() * 7) + 7;
    } else if (i < 30) {
      // Last month customers (15-30 days ago)
      daysAgo = Math.floor(Math.random() * 16) + 14;
    } else {
      // Older customers (31-365 days ago)
      daysAgo = Math.floor(Math.random() * 335) + 30;
    }
    const createdAt = new Date(now);
    createdAt.setDate(createdAt.getDate() - daysAgo);

    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];

    // Add some birthdays this week for testing
    let dateOfBirth: string;
    if (i === 0) {
      // Customer birthday in 2 days
      const birthdayDate = new Date(now);
      birthdayDate.setDate(birthdayDate.getDate() + 2);
      dateOfBirth = new Date(1985, birthdayDate.getMonth(), birthdayDate.getDate()).toISOString().split('T')[0];
    } else if (i === 1) {
      // Customer birthday in 5 days
      const birthdayDate = new Date(now);
      birthdayDate.setDate(birthdayDate.getDate() + 5);
      dateOfBirth = new Date(1990, birthdayDate.getMonth(), birthdayDate.getDate()).toISOString().split('T')[0];
    } else {
      dateOfBirth = new Date(1980 + Math.floor(Math.random() * 30), Math.floor(Math.random() * 12), 1).toISOString().split('T')[0];
    }

    const hasChildren = Math.random() > 0.6;
    let children;
    if (i === 2) {
      // Child birthday in 3 days
      const childBirthdayDate = new Date(now);
      childBirthdayDate.setDate(childBirthdayDate.getDate() + 3);
      children = [
        {
          name: 'Emma',
          birthDate: new Date(2018, childBirthdayDate.getMonth(), childBirthdayDate.getDate()).toISOString().split('T')[0],
          gender: 'female' as 'female',
        },
      ];
    } else if (i === 3) {
      // Child birthday in 6 days
      const childBirthdayDate = new Date(now);
      childBirthdayDate.setDate(childBirthdayDate.getDate() + 6);
      children = [
        {
          name: 'Liam',
          birthDate: new Date(2016, childBirthdayDate.getMonth(), childBirthdayDate.getDate()).toISOString().split('T')[0],
          gender: 'male' as 'male',
        },
      ];
    } else {
      children = hasChildren ? [
        {
          name: ['Emma', 'Sofia', 'Liam', 'Noah'][Math.floor(Math.random() * 4)],
          birthDate: new Date(2015 + Math.floor(Math.random() * 8), Math.floor(Math.random() * 12), 1).toISOString().split('T')[0],
          gender: ['male', 'female'][Math.floor(Math.random() * 2)] as 'male' | 'female',
        },
      ] : undefined;
    }

    // Generate preferences for some customers
    const hasPreferences = Math.random() > 0.5;
    const allGenders = ['Boy', 'Girl', 'Unisex'];
    const allStyles = ['Casual', 'Formal', 'Sporty', 'Elegant', 'Vintage', 'Modern'];
    const allAgeRanges = ['Newborn', 'Kid', 'Teen'];

    const preferences = hasPreferences ? {
      gender: allGenders.filter(() => Math.random() > 0.6),
      style: allStyles.filter(() => Math.random() > 0.7),
      ageRange: allAgeRanges.filter(() => Math.random() > 0.6),
      notes: Math.random() > 0.7 ? 'Prefers elegant styles for special occasions' : undefined,
    } : undefined;

    const city = cities[Math.floor(Math.random() * cities.length)];
    const street = streets[Math.floor(Math.random() * streets.length)];
    const streetNumber = Math.floor(Math.random() * 200) + 1;

    // Randomly assign a sales associate
    const salesAssociate = SALES_ASSOCIATES[Math.floor(Math.random() * SALES_ASSOCIATES.length)];

    customers.push({
      id: `cust-${String(i + 1).padStart(3, '0')}`,
      firstName,
      lastName,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@email.com`,
      phone: `+39 ${Math.floor(Math.random() * 900 + 100)} ${Math.floor(Math.random() * 9000000 + 1000000)}`,
      dateOfBirth,
      address: `${street} ${streetNumber}`,
      city: city,
      postalCode: `${Math.floor(Math.random() * 90000) + 10000}`,
      country: 'Italy',
      children,
      loyaltyEnrollment: true,
      marketingConsent: Math.random() > 0.3,
      privacyConsent: true,
      preferences,
      storeId: STORE_DATA.storeId,
      salesAssociateId: salesAssociate.id,
      createdAt: createdAt.toISOString(),
    });
  }

  return customers.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

const customers: Customer[] = generateCustomers();

// Generate purchases
const generatePurchases = (): Purchase[] => {
  const purchases: Purchase[] = [];
  const now = new Date();

  const items = [
    'Floral Dress',
    'Embroidered T-Shirt',
    'Silk Blouse',
    'Cotton Shorts',
    'Summer Dress',
    'Lace Cardigan',
    'Party Dress',
    'Denim Jacket',
    'Leather Shoes',
    'Ballet Flats',
    'Hair Accessories Set',
    'Designer Handbag'
  ];

  // Generate 50 purchases for random customers
  for (let i = 0; i < 50; i++) {
    const customer = customers[Math.floor(Math.random() * customers.length)];
    const daysAgo = Math.floor(Math.random() * 365); // Last 12 months
    const purchaseDate = new Date(now);
    purchaseDate.setDate(purchaseDate.getDate() - daysAgo);

    const itemCount = Math.floor(Math.random() * 3) + 1; // 1-3 items
    const purchaseItems: string[] = [];
    for (let j = 0; j < itemCount; j++) {
      purchaseItems.push(items[Math.floor(Math.random() * items.length)]);
    }

    const amount = Math.floor(Math.random() * 400) + 50; // €50-€450

    purchases.push({
      id: `purchase-${String(i + 1).padStart(3, '0')}`,
      customerId: customer.id,
      customerName: `${customer.firstName} ${customer.lastName}`,
      date: purchaseDate.toISOString(),
      amount,
      items: purchaseItems,
      storeId: STORE_DATA.storeId,
    });
  }

  return purchases.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

const purchases: Purchase[] = generatePurchases();

// Calculate top customers (last 12 months)
const calculateTopCustomers = (): TopCustomer[] => {
  const now = new Date();
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const customerPurchases = new Map<string, { customer: Customer, purchases: Purchase[], totalSpent: number }>();

  // Group purchases by customer (last 12 months only)
  purchases
    .filter(p => new Date(p.date) >= twelveMonthsAgo)
    .forEach(purchase => {
      const customer = customers.find(c => c.id === purchase.customerId);
      if (!customer) return;

      if (!customerPurchases.has(purchase.customerId)) {
        customerPurchases.set(purchase.customerId, {
          customer,
          purchases: [],
          totalSpent: 0,
        });
      }

      const data = customerPurchases.get(purchase.customerId)!;
      data.purchases.push(purchase);
      data.totalSpent += purchase.amount;
    });

  // Convert to TopCustomer array and sort by total spent
  const topCustomers: TopCustomer[] = Array.from(customerPurchases.values())
    .map(data => ({
      id: data.customer.id,
      firstName: data.customer.firstName,
      lastName: data.customer.lastName,
      email: data.customer.email,
      totalPurchases: data.purchases.length,
      totalSpent: data.totalSpent,
      lastPurchaseDate: data.purchases.sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      )[0].date,
      rank: calculateRank(data.totalSpent),
      salesAssociateName: getSalesAssociateName(data.customer.salesAssociateId),
    }))
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 10); // Top 10

  return topCustomers;
};

// Calculate customer rank based on total spent
const calculateRank = (totalSpent: number): 'Bronze' | 'Silver' | 'Gold' | 'Platinum' => {
  if (totalSpent >= 2000) return 'Platinum';
  if (totalSpent >= 1000) return 'Gold';
  if (totalSpent >= 500) return 'Silver';
  return 'Bronze';
};

// Enrich customer with purchase data
const enrichCustomerWithPurchaseData = (customer: Customer): Customer => {
  const customerPurchases = purchases.filter(p => p.customerId === customer.id);
  const totalSpent = customerPurchases.reduce((sum, p) => sum + p.amount, 0);
  const totalPurchases = customerPurchases.length;
  const rank = calculateRank(totalSpent);

  return {
    ...customer,
    totalPurchases,
    totalSpent,
    rank,
  };
};

// Calculate upcoming birthdays this week
const calculateUpcomingBirthdays = (): Birthday[] => {
  const birthdays: Birthday[] = [];
  const now = new Date();
  const weekFromNow = new Date(now);
  weekFromNow.setDate(weekFromNow.getDate() + 7);

  const isBirthdayThisWeek = (birthDate: string): boolean => {
    const birth = new Date(birthDate);
    const thisYearBirthday = new Date(now.getFullYear(), birth.getMonth(), birth.getDate());

    // If birthday already passed this year, check next year
    if (thisYearBirthday < now) {
      thisYearBirthday.setFullYear(now.getFullYear() + 1);
    }

    return thisYearBirthday >= now && thisYearBirthday <= weekFromNow;
  };

  const calculateAge = (birthDate: string): number => {
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }

    return age + 1; // +1 for upcoming birthday
  };

  // Check customer birthdays
  customers.forEach(customer => {
    if (customer.dateOfBirth && isBirthdayThisWeek(customer.dateOfBirth)) {
      birthdays.push({
        id: `birthday-customer-${customer.id}`,
        name: `${customer.firstName} ${customer.lastName}`,
        type: 'customer',
        birthDate: customer.dateOfBirth,
        age: calculateAge(customer.dateOfBirth),
        customerId: customer.id,
      });
    }

    // Check children birthdays
    if (customer.children) {
      customer.children.forEach((child, index) => {
        if (child.birthDate && isBirthdayThisWeek(child.birthDate)) {
          birthdays.push({
            id: `birthday-child-${customer.id}-${index}`,
            name: child.name || 'Child',
            type: 'child',
            birthDate: child.birthDate,
            age: calculateAge(child.birthDate),
            customerName: `${customer.firstName} ${customer.lastName}`,
            customerId: customer.id,
          });
        }
      });
    }
  });

  // Sort by date
  return birthdays.sort((a, b) => {
    const dateA = new Date(a.birthDate);
    const dateB = new Date(b.birthDate);
    dateA.setFullYear(now.getFullYear());
    dateB.setFullYear(now.getFullYear());
    return dateA.getTime() - dateB.getTime();
  });
};

// Calculate stats
const calculateStats = (): Stats => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 7);
  const lastWeekStart = new Date(now);
  lastWeekStart.setDate(lastWeekStart.getDate() - 14);
  const lastMonthStart = new Date(now);
  lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const registeredToday = customers.filter(c => new Date(c.createdAt) >= todayStart).length;
  const registeredThisWeek = customers.filter(c => new Date(c.createdAt) >= weekStart).length;
  const registeredLastWeek = customers.filter(c => {
    const createdAt = new Date(c.createdAt);
    return createdAt >= lastWeekStart && createdAt < weekStart;
  }).length;
  const registeredLastMonth = customers.filter(c => {
    const createdAt = new Date(c.createdAt);
    return createdAt >= lastMonthStart && createdAt < now;
  }).length;
  const totalEnrollments = customers.filter(c => c.loyaltyEnrollment).length;
  const marketingConsentCount = customers.filter(c => c.marketingConsent).length;
  const marketingConsentRate = customers.length > 0 ? Math.round((marketingConsentCount / customers.length) * 100) : 0;

  // Enrich recent customers with purchase data
  const recentCustomers = customers.slice(0, 10).map(enrichCustomerWithPurchaseData);

  // Get customers from last week
  const lastWeekCustomers = customers
    .filter(c => {
      const createdAt = new Date(c.createdAt);
      return createdAt >= lastWeekStart && createdAt < weekStart;
    })
    .map(enrichCustomerWithPurchaseData);

  // Get customers from last month
  const lastMonthCustomers = customers
    .filter(c => {
      const createdAt = new Date(c.createdAt);
      return createdAt >= lastMonthStart && createdAt < now;
    })
    .map(enrichCustomerWithPurchaseData);

  // Get customers from last 12 months
  const last12MonthsCustomers = customers
    .filter(c => new Date(c.createdAt) >= twelveMonthsAgo)
    .map(enrichCustomerWithPurchaseData);

  return {
    registeredToday,
    registeredThisWeek,
    registeredLastWeek,
    registeredLastMonth,
    totalEnrollments,
    marketingConsentRate,
    recentCustomers,
    lastWeekCustomers,
    lastMonthCustomers,
    recentPurchases: purchases.slice(0, 10),
    topCustomers: calculateTopCustomers(),
    upcomingBirthdaysThisWeek: calculateUpcomingBirthdays(),
    last12MonthsCustomers,
  };
};

// Mock handlers
const handlers = [
  // Login
  http.post('/api/auth/login', async ({ request }) => {
    const body = await request.json() as { email: string; password: string };

    if (body.email === 'assistant@monnalisa.com' && body.password === 'password123') {
      return HttpResponse.json({
        token: 'mock-token-123',
        ...STORE_DATA,
        salesAssociateName: getSalesAssociateName(STORE_DATA.salesAssociateId),
        email: body.email,
      });
    }

    return HttpResponse.json(
      { error: 'Invalid credentials' },
      { status: 401 }
    );
  }),

  // Get stats
  http.get('/api/stats', () => {
    try {
      const stats = calculateStats();
      console.log('MSW: Calculated stats:', stats);
      return HttpResponse.json(stats);
    } catch (error) {
      console.error('MSW: Error calculating stats:', error);
      return HttpResponse.json(
        { error: 'Failed to calculate stats', details: String(error) },
        { status: 500 }
      );
    }
  }),

  // Check email uniqueness
  http.get('/api/customers/check-email', ({ request }) => {
    const url = new URL(request.url);
    const email = url.searchParams.get('email')?.toLowerCase() || '';

    if (!email) {
      return HttpResponse.json({ available: true });
    }

    const existingCustomer = customers.find(c => c.email.toLowerCase() === email);

    if (existingCustomer) {
      return HttpResponse.json({
        available: false,
        message: 'This email is already registered',
        suggestion: 'A customer with this email already exists. Would you like to search for them?',
        customer: {
          id: existingCustomer.id,
          firstName: existingCustomer.firstName,
          lastName: existingCustomer.lastName,
          email: existingCustomer.email,
        }
      });
    }

    return HttpResponse.json({ available: true });
  }),

  // Check phone uniqueness
  http.get('/api/customers/check-phone', ({ request }) => {
    const url = new URL(request.url);
    const phone = url.searchParams.get('phone') || '';

    if (!phone) {
      return HttpResponse.json({ available: true });
    }

    // Normalize phone number for comparison (remove spaces and special chars)
    const normalizedPhone = phone.replace(/[\s\-\(\)]/g, '');

    const existingCustomer = customers.find(c => {
      if (!c.phone) return false;
      const normalizedCustomerPhone = c.phone.replace(/[\s\-\(\)]/g, '');
      return normalizedCustomerPhone === normalizedPhone;
    });

    if (existingCustomer) {
      return HttpResponse.json({
        available: false,
        message: 'This phone number is already registered',
        suggestion: 'A customer with this phone number already exists. Would you like to search for them?',
        customer: {
          id: existingCustomer.id,
          firstName: existingCustomer.firstName,
          lastName: existingCustomer.lastName,
          phone: existingCustomer.phone,
        }
      });
    }

    return HttpResponse.json({ available: true });
  }),

  // Search customers
  http.get('/api/customers/search', ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('q')?.toLowerCase() || '';

    if (!query) {
      return HttpResponse.json([]);
    }

    const results = customers
      .filter(customer => {
        const fullName = `${customer.firstName} ${customer.lastName}`.toLowerCase();
        const email = customer.email.toLowerCase();
        const phone = (customer.phone || '').toLowerCase();
        return fullName.includes(query) || email.includes(query) || phone.includes(query);
      })
      .slice(0, 10) // Limit to 10 results
      .map(customer => ({
        id: customer.id,
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        phone: customer.phone,
      }));

    return HttpResponse.json(results);
  }),

  // Get customer by ID
  http.get('/api/customers/:id', ({ params }) => {
    const { id } = params;
    const customer = customers.find(c => c.id === id);

    if (!customer) {
      return HttpResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Enrich customer with purchase data
    const enrichedCustomer = enrichCustomerWithPurchaseData(customer);

    return HttpResponse.json(enrichedCustomer);
  }),

  // Get purchases for a customer
  http.get('/api/customers/:id/purchases', ({ params }) => {
    const { id } = params;
    const customer = customers.find(c => c.id === id);

    if (!customer) {
      return HttpResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    const customerPurchases = purchases
      .filter(p => p.customerId === id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return HttpResponse.json(customerPurchases);
  }),

  // Update customer
  http.put('/api/customers/:id', async ({ params, request }) => {
    const { id } = params;
    const customerIndex = customers.findIndex(c => c.id === id);

    if (customerIndex === -1) {
      return HttpResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    const body = await request.json() as Partial<Customer>;

    // Update customer data
    customers[customerIndex] = {
      ...customers[customerIndex],
      ...body,
      id: customers[customerIndex].id, // Keep original ID
      createdAt: customers[customerIndex].createdAt, // Keep original creation date
    };

    // Enrich with purchase data
    const enrichedCustomer = enrichCustomerWithPurchaseData(customers[customerIndex]);

    return HttpResponse.json(enrichedCustomer);
  }),

  // Create customer
  http.post('/api/customers', async ({ request }) => {
    const body = await request.json() as Omit<Customer, 'id' | 'createdAt'>;

    // Check for duplicate email
    const existingCustomer = customers.find(c => c.email.toLowerCase() === body.email.toLowerCase());
    if (existingCustomer) {
      return HttpResponse.json(
        { error: 'Email already exists' },
        { status: 409 }
      );
    }

    const newCustomer: Customer = {
      ...body,
      id: `cust-${String(customers.length + 1).padStart(3, '0')}`,
      createdAt: new Date().toISOString(),
    };

    customers.unshift(newCustomer);

    return HttpResponse.json(newCustomer, { status: 201 });
  }),
];

export const worker = setupWorker(...handlers);
