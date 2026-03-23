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
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
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
      'First Name', 'Last Name', 'Email', 'Phone', 'Date of Birth', 'City', 'Country',
      'Loyalty Enrollment', 'Marketing Consent', 'Total Purchases', 'Total Spent', 'Rank',
      'Registration Date', 'Children Count'
    ];

    const rows = stats.last12MonthsCustomers.map((customer: Customer) => [
      customer.firstName, customer.lastName, customer.email, customer.phone || '',
      customer.dateOfBirth || '', customer.city || '', customer.country || '',
      customer.loyaltyEnrollment ? 'Yes' : 'No', customer.marketingConsent ? 'Yes' : 'No',
      customer.totalPurchases || 0, customer.totalSpent?.toFixed(2) || '0.00',
      customer.rank || 'Bronze', new Date(customer.createdAt).toLocaleDateString(),
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
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-3 text-gray-400">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading dashboard...
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            {session && (
              <p className="text-sm text-gray-500 mt-1">{session.storeName}</p>
            )}
          </div>
          <Link to="/customers/new">
            <Button>+ New Customer</Button>
          </Link>
        </div>
        <Card className="text-center py-12">
          <p className="text-gray-400 mb-4">Dashboard data is not available yet.</p>
          <Link to="/customers/new">
            <Button>+ New Customer</Button>
          </Link>
          <p className="text-xs text-gray-300 mt-6">
            Development only: <Link to="/uat" className="text-gray-400 underline hover:text-gray-600 transition-colors">UAT Testing Page</Link>
          </p>
        </Card>
      </div>
    );
  }

  const getRankColor = (rank?: string) => {
    switch (rank) {
      case 'Platinum': return 'bg-gradient-to-r from-gray-500 to-gray-400 text-white';
      case 'Gold': return 'bg-gradient-to-r from-yellow-500 to-amber-400 text-white';
      case 'Silver': return 'bg-gradient-to-r from-gray-400 to-gray-300 text-gray-800';
      case 'Bronze': return 'bg-gradient-to-r from-orange-600 to-orange-500 text-white';
      default: return 'bg-gray-200 text-gray-600';
    }
  };

  const kpis = [
    { label: 'Today', value: stats.registeredToday, color: 'text-gray-900' },
    { label: 'This Week', value: stats.registeredThisWeek, color: 'text-gray-900' },
    { label: 'Last Week', value: stats.registeredLastWeek, color: 'text-gray-900' },
    { label: 'Last Month', value: stats.registeredLastMonth, color: 'text-gray-900' },
    { label: 'Total Enrollments', value: stats.totalEnrollments, color: 'text-gray-900' },
    { label: 'Marketing Consent', value: `${stats.marketingConsentRate}%`, color: 'text-gray-900' },
  ];

  const CustomerTable = ({ customers, title }: { customers: Customer[]; title: string }) => (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900">{title} <span className="text-gray-400 font-normal">({customers.length})</span></h2>
      </div>
      <div className="overflow-x-auto -mx-6">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2.5 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">Customer</th>
              <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Email</th>
              <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Date</th>
              <th className="text-center py-2.5 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Rank</th>
              <th className="text-center py-2.5 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Loyalty</th>
              <th className="text-right py-2.5 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider"></th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr key={customer.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                <td className="py-3 px-6">
                  <p className="font-medium text-gray-900 text-sm">{customer.firstName} {customer.lastName}</p>
                  {customer.children && customer.children.length > 0 && (
                    <p className="text-xs text-gray-400">{customer.children.length} {customer.children.length === 1 ? 'child' : 'children'}</p>
                  )}
                </td>
                <td className="py-3 px-4 text-sm text-gray-500">{customer.email}</td>
                <td className="py-3 px-4 text-sm text-gray-500">{new Date(customer.createdAt).toLocaleDateString()}</td>
                <td className="py-3 px-4 text-center">
                  <span className={`inline-block px-2.5 py-0.5 rounded-lg text-xs font-semibold ${getRankColor(customer.rank)}`}>
                    {customer.rank || 'Bronze'}
                  </span>
                </td>
                <td className="py-3 px-4 text-center">
                  <span className={`inline-block w-2.5 h-2.5 rounded-full ${customer.loyaltyEnrollment ? 'bg-green-400' : 'bg-gray-200'}`}></span>
                </td>
                <td className="py-3 px-6 text-right">
                  <Link to={`/customers/${encodeURIComponent(customer.email)}`}>
                    <Button variant="outline" className="text-xs py-1.5 px-3">View</Button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          {session && (
            <p className="text-sm text-gray-500 mt-1">{session.storeName}</p>
          )}
        </div>
        <Link to="/customers/new">
          <Button>+ New Customer</Button>
        </Link>
      </div>

      {/* Birthdays Banner */}
      {stats.upcomingBirthdaysThisWeek && stats.upcomingBirthdaysThisWeek.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Upcoming Birthdays</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {stats.upcomingBirthdaysThisWeek.map((birthday) => (
              <div key={birthday.id} className="bg-gradient-to-br from-pink-50 to-purple-50 border border-pink-200 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-lg shadow-sm">
                    {birthday.type === 'customer' ? '\uD83C\uDF82' : '\uD83C\uDF88'}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{birthday.name}</p>
                    <p className="text-xs text-gray-500">
                      {birthday.type === 'child' ? `Child of ${birthday.customerName}` : 'Customer'} &middot; Turning {birthday.age}
                    </p>
                  </div>
                </div>
                <Link to={`/customers/${encodeURIComponent(birthday.customerEmail || birthday.customerId)}`}>
                  <Button variant="outline" className="text-xs py-1.5 px-3">View</Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="text-center !p-4">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1">{kpi.label}</p>
            <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
          </Card>
        ))}
      </div>

      {/* Tables */}
      <div className="space-y-6">
        {stats.lastWeekCustomers && stats.lastWeekCustomers.length > 0 && (
          <CustomerTable customers={stats.lastWeekCustomers} title="Last Week" />
        )}

        {stats.lastMonthCustomers && stats.lastMonthCustomers.length > 0 && (
          <CustomerTable customers={stats.lastMonthCustomers} title="Last Month" />
        )}

        {/* Recent Purchases */}
        <Card className="overflow-hidden">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Recent Purchases</h2>
          <div className="overflow-x-auto -mx-6">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2.5 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">Customer</th>
                  <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Items</th>
                  <th className="text-center py-2.5 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Qty</th>
                  <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Date</th>
                  <th className="text-right py-2.5 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">Amount</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentPurchases.map((purchase) => (
                  <tr key={purchase.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 px-6">
                      <Link to={`/customers/${encodeURIComponent(purchase.customerEmail || purchase.customerId)}`} className="font-medium text-gray-900 hover:text-gray-600 text-sm transition-colors">
                        {purchase.customerName}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500 max-w-[200px] truncate">{purchase.items.join(', ')}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md text-xs font-medium">
                        {purchase.items.length}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500">{new Date(purchase.date).toLocaleDateString()}</td>
                    <td className="py-3 px-6 text-sm font-semibold text-gray-900 text-right">&euro;{purchase.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Top Customers */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">Top Customers <span className="text-gray-400 font-normal">- Last 12 Months</span></h2>
            <Button
              onClick={exportToCSV}
              variant="outline"
              disabled={!stats.last12MonthsCustomers || stats.last12MonthsCustomers.length === 0}
              className="text-xs"
            >
              Export CSV
            </Button>
          </div>
          <div className="overflow-x-auto -mx-6">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2.5 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">Rank</th>
                  <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Customer</th>
                  <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Registered By</th>
                  <th className="text-center py-2.5 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Purchases</th>
                  <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Total Spent</th>
                  <th className="text-right py-2.5 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody>
                {stats.topCustomers.map((customer) => (
                  <tr key={customer.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 px-6">
                      <span className={`inline-block px-2.5 py-0.5 rounded-lg text-xs font-semibold ${getRankColor(customer.rank)}`}>
                        {customer.rank}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-gray-900 text-sm">{customer.firstName} {customer.lastName}</p>
                      <p className="text-xs text-gray-400">{customer.email}</p>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500">{customer.salesAssociateName}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md text-xs font-medium">
                        {customer.totalPurchases}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm font-semibold text-gray-900 text-right">&euro;{customer.totalSpent.toFixed(2)}</td>
                    <td className="py-3 px-6 text-right">
                      <Link to={`/customers/${encodeURIComponent(customer.email)}`}>
                        <Button variant="outline" className="text-xs py-1.5 px-3">View</Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Recent Registrations */}
        <CustomerTable customers={stats.recentCustomers} title="Recent Registrations" />
      </div>
    </div>
  );
}
