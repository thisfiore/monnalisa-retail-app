import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { useAuth } from '../lib/auth';
import type { Stats, Customer } from '../lib/types';

export function Dashboard() {
  const { session } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/stats');
      console.log('Stats response status:', response.status);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Stats data:', data);
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const exportToCSV = () => {
    if (!stats?.last12MonthsCustomers) return;

    const headers = [
      'First Name',
      'Last Name',
      'Email',
      'Phone',
      'Date of Birth',
      'City',
      'Country',
      'Loyalty Enrollment',
      'Marketing Consent',
      'Total Purchases',
      'Total Spent',
      'Rank',
      'Registration Date',
      'Children Count'
    ];

    const rows = stats.last12MonthsCustomers.map((customer: Customer) => [
      customer.firstName,
      customer.lastName,
      customer.email,
      customer.phone || '',
      customer.dateOfBirth || '',
      customer.city || '',
      customer.country || '',
      customer.loyaltyEnrollment ? 'Yes' : 'No',
      customer.marketingConsent ? 'Yes' : 'No',
      customer.totalPurchases || 0,
      customer.totalSpent?.toFixed(2) || '0.00',
      customer.rank || 'Bronze',
      new Date(customer.createdAt).toLocaleDateString(),
      customer.children?.length || 0
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `customers_last_12_months_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-red-600">Failed to load stats</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Store Dashboard</h1>
          {session && (
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-blue-500"></span>
                <span className="font-medium">{session.storeName}</span>
              </div>
              {session.salesAssociateName && (
                <>
                  <span className="text-gray-400">•</span>
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                    <span>Store Manager: <span className="font-medium">{session.salesAssociateName}</span></span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        <Link to="/customers/new">
          <Button>Register New Customer</Button>
        </Link>
      </div>

      {/* Upcoming Birthdays Section */}
      {stats.upcomingBirthdaysThisWeek && stats.upcomingBirthdaysThisWeek.length > 0 && (
        <Card title="Upcoming Birthdays This Week" className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stats.upcomingBirthdaysThisWeek.map((birthday) => (
              <div key={birthday.id} className="border rounded-lg p-4 bg-gradient-to-br from-pink-50 to-purple-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xl">
                        {birthday.type === 'customer' ? '🎂' : '🎈'}
                      </span>
                      <h3 className="font-semibold text-gray-900">{birthday.name}</h3>
                    </div>
                    <p className="text-sm text-gray-600">
                      {birthday.type === 'customer' ? 'Customer' : `Child of ${birthday.customerName}`}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(birthday.birthDate).toLocaleDateString()} • Turning {birthday.age}
                    </p>
                  </div>
                  <Link to={`/customers/${birthday.customerId}`}>
                    <Button variant="outline" className="text-xs py-1 px-2">
                      View
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <Card className="text-center">
          <p className="text-sm text-gray-600 mb-2">Registered Today</p>
          <p className="text-4xl font-bold text-blue-600">{stats.registeredToday}</p>
        </Card>

        <Card className="text-center">
          <p className="text-sm text-gray-600 mb-2">Registered This Week</p>
          <p className="text-4xl font-bold text-green-600">{stats.registeredThisWeek}</p>
        </Card>

        <Card className="text-center">
          <p className="text-sm text-gray-600 mb-2">Registered Last Week</p>
          <p className="text-4xl font-bold text-indigo-600">{stats.registeredLastWeek}</p>
        </Card>

        <Card className="text-center">
          <p className="text-sm text-gray-600 mb-2">Registered Last Month</p>
          <p className="text-4xl font-bold text-teal-600">{stats.registeredLastMonth}</p>
        </Card>

        <Card className="text-center">
          <p className="text-sm text-gray-600 mb-2">Total Enrollments</p>
          <p className="text-4xl font-bold text-purple-600">{stats.totalEnrollments}</p>
        </Card>

        <Card className="text-center">
          <p className="text-sm text-gray-600 mb-2">Marketing Consent Rate</p>
          <p className="text-4xl font-bold text-orange-600">{stats.marketingConsentRate}%</p>
        </Card>
      </div>

      {/* Last Week Customers */}
      {stats.lastWeekCustomers && stats.lastWeekCustomers.length > 0 && (
        <Card className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Last Week Customers ({stats.lastWeekCustomers.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Customer</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Email</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Registration Date</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Purchases</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Rank</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Loyalty</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Marketing</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {stats.lastWeekCustomers.map((customer) => {
                  const getRankColor = (rank?: string) => {
                    switch (rank) {
                      case 'Platinum':
                        return 'bg-gradient-to-r from-gray-400 to-gray-300 text-white';
                      case 'Gold':
                        return 'bg-gradient-to-r from-yellow-500 to-yellow-400 text-white';
                      case 'Silver':
                        return 'bg-gradient-to-r from-gray-300 to-gray-200 text-gray-800';
                      case 'Bronze':
                        return 'bg-gradient-to-r from-orange-600 to-orange-500 text-white';
                      default:
                        return 'bg-gray-200 text-gray-600';
                    }
                  };

                  return (
                    <tr key={customer.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <p className="font-medium text-gray-900">
                          {customer.firstName} {customer.lastName}
                        </p>
                        {customer.children && customer.children.length > 0 && (
                          <p className="text-xs text-gray-500">
                            {customer.children.length} {customer.children.length === 1 ? 'child' : 'children'}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">{customer.email}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {new Date(customer.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-block px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
                          {customer.totalPurchases || 0}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${getRankColor(customer.rank)}`}>
                          {customer.rank || 'Bronze'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {customer.loyaltyEnrollment ? (
                          <span className="inline-block w-3 h-3 rounded-full bg-green-500"></span>
                        ) : (
                          <span className="inline-block w-3 h-3 rounded-full bg-gray-300"></span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {customer.marketingConsent ? (
                          <span className="inline-block w-3 h-3 rounded-full bg-green-500"></span>
                        ) : (
                          <span className="inline-block w-3 h-3 rounded-full bg-gray-300"></span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link to={`/customers/${customer.id}`}>
                          <Button variant="outline" className="text-sm py-1 px-3">
                            View
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Last Month Customers */}
      {stats.lastMonthCustomers && stats.lastMonthCustomers.length > 0 && (
        <Card className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Last Month Customers ({stats.lastMonthCustomers.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Customer</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Email</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Registration Date</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Purchases</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Rank</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Loyalty</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Marketing</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {stats.lastMonthCustomers.map((customer) => {
                  const getRankColor = (rank?: string) => {
                    switch (rank) {
                      case 'Platinum':
                        return 'bg-gradient-to-r from-gray-400 to-gray-300 text-white';
                      case 'Gold':
                        return 'bg-gradient-to-r from-yellow-500 to-yellow-400 text-white';
                      case 'Silver':
                        return 'bg-gradient-to-r from-gray-300 to-gray-200 text-gray-800';
                      case 'Bronze':
                        return 'bg-gradient-to-r from-orange-600 to-orange-500 text-white';
                      default:
                        return 'bg-gray-200 text-gray-600';
                    }
                  };

                  return (
                    <tr key={customer.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <p className="font-medium text-gray-900">
                          {customer.firstName} {customer.lastName}
                        </p>
                        {customer.children && customer.children.length > 0 && (
                          <p className="text-xs text-gray-500">
                            {customer.children.length} {customer.children.length === 1 ? 'child' : 'children'}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">{customer.email}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {new Date(customer.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-block px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
                          {customer.totalPurchases || 0}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${getRankColor(customer.rank)}`}>
                          {customer.rank || 'Bronze'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {customer.loyaltyEnrollment ? (
                          <span className="inline-block w-3 h-3 rounded-full bg-green-500"></span>
                        ) : (
                          <span className="inline-block w-3 h-3 rounded-full bg-gray-300"></span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {customer.marketingConsent ? (
                          <span className="inline-block w-3 h-3 rounded-full bg-green-500"></span>
                        ) : (
                          <span className="inline-block w-3 h-3 rounded-full bg-gray-300"></span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link to={`/customers/${customer.id}`}>
                          <Button variant="outline" className="text-sm py-1 px-3">
                            View
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Recent Purchases */}
      <Card title="Recent Purchases" className="mb-8">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Customer</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Items</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Nr Items</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Date</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Amount</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentPurchases.map((purchase) => (
                <tr key={purchase.id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <Link to={`/customers/${purchase.customerId}`} className="font-medium text-blue-600 hover:underline">
                      {purchase.customerName}
                    </Link>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    {purchase.items.join(', ')}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-block px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm font-medium">
                      {purchase.items.length}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    {new Date(purchase.date).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-sm font-semibold text-gray-900 text-right">
                    €{purchase.amount.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Top Customers - Last 12 Months */}
      <Card className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Top Customers - Last 12 Months</h2>
          <Button
            onClick={exportToCSV}
            variant="outline"
            disabled={!stats.last12MonthsCustomers || stats.last12MonthsCustomers.length === 0}
          >
            Download CSV Export
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Rank</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Customer</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Email</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Registered By</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Purchases</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Total Spent</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Last Purchase</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {stats.topCustomers.map((customer, index) => {
                const getRankColor = (rank: string) => {
                  switch (rank) {
                    case 'Platinum':
                      return 'bg-gradient-to-r from-gray-400 to-gray-300 text-white';
                    case 'Gold':
                      return 'bg-gradient-to-r from-yellow-500 to-yellow-400 text-white';
                    case 'Silver':
                      return 'bg-gradient-to-r from-gray-300 to-gray-200 text-gray-800';
                    case 'Bronze':
                      return 'bg-gradient-to-r from-orange-600 to-orange-500 text-white';
                    default:
                      return 'bg-gray-200 text-gray-600';
                  }
                };

                return (
                  <tr key={customer.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${getRankColor(customer.rank)}`}>
                        {customer.rank}
                      </span>
                    </td>
                  <td className="py-3 px-4">
                    <Link to={`/customers/${customer.id}`} className="font-medium text-blue-600 hover:underline">
                      {customer.firstName} {customer.lastName}
                    </Link>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">{customer.email}</td>
                  <td className="py-3 px-4 text-sm text-gray-700">
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                      {customer.salesAssociateName}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                      {customer.totalPurchases}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm font-semibold text-gray-900 text-right">
                    €{customer.totalSpent.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    {new Date(customer.lastPurchaseDate).toLocaleDateString()}
                  </td>
                    <td className="py-3 px-4 text-right">
                      <Link to={`/customers/${customer.id}`}>
                        <Button variant="outline" className="text-sm py-1 px-3">
                          View
                        </Button>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Recent Registrations Table */}
      <Card title="Recent Registrations">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Customer</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Email</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Date</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Purchases</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Rank</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Loyalty</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Marketing</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentCustomers.map((customer) => {
                const getRankColor = (rank?: string) => {
                  switch (rank) {
                    case 'Platinum':
                      return 'bg-gradient-to-r from-gray-400 to-gray-300 text-white';
                    case 'Gold':
                      return 'bg-gradient-to-r from-yellow-500 to-yellow-400 text-white';
                    case 'Silver':
                      return 'bg-gradient-to-r from-gray-300 to-gray-200 text-gray-800';
                    case 'Bronze':
                      return 'bg-gradient-to-r from-orange-600 to-orange-500 text-white';
                    default:
                      return 'bg-gray-200 text-gray-600';
                  }
                };

                return (
                  <tr key={customer.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <p className="font-medium text-gray-900">
                        {customer.firstName} {customer.lastName}
                      </p>
                      {customer.children && customer.children.length > 0 && (
                        <p className="text-xs text-gray-500">
                          {customer.children.length} {customer.children.length === 1 ? 'child' : 'children'}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{customer.email}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {new Date(customer.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-block px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
                        {customer.totalPurchases || 0}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${getRankColor(customer.rank)}`}>
                        {customer.rank || 'Bronze'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {customer.loyaltyEnrollment ? (
                        <span className="inline-block w-3 h-3 rounded-full bg-green-500"></span>
                      ) : (
                        <span className="inline-block w-3 h-3 rounded-full bg-gray-300"></span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {customer.marketingConsent ? (
                        <span className="inline-block w-3 h-3 rounded-full bg-green-500"></span>
                      ) : (
                        <span className="inline-block w-3 h-3 rounded-full bg-gray-300"></span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link to={`/customers/${customer.id}`}>
                        <Button variant="outline" className="text-sm py-1 px-3">
                          View
                        </Button>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
