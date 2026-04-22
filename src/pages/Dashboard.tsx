import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { useAuth } from '../lib/auth';
import type { Customer } from '../lib/types';
import type { CustomerSegmentRecord } from '../lib/api-types';
import { customerApi } from '../lib/api-client';

function segmentToCustomer(s: CustomerSegmentRecord, storeId: string): Customer {
  const tier = s.LoyaltyTier__c;
  const rank = tier && ['Family', 'Flower', 'Fairytale', 'Fashion'].includes(tier)
    ? (tier as Customer['rank'])
    : undefined;
  return {
    id: s.EmailKey__c ?? '',
    firstName: s.FirstName ?? '',
    lastName: s.LastName ?? '',
    email: s.EmailKey__c ?? '',
    createdAt: s.CreatedDate ?? new Date().toISOString(),
    rank,
    loyaltyEnrollment: !!s.LoyaltyConsent__c,
    loyaltyDoubleOptIn: false,
    marketingConsent: !!s.MarketingConsent__c,
    privacyConsent: false,
    storeId,
    salesAssociateId: '',
  };
}

export function Dashboard() {
  const { session, getValidToken } = useAuth();
  const [thisWeek, setThisWeek] = useState<CustomerSegmentRecord[]>([]);
  const [lastWeek, setLastWeek] = useState<CustomerSegmentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    (async () => {
      try {
        const token = await getValidToken();
        const [tw, lw] = await Promise.all([
          customerApi.getCustomersCreatedThisWeek(session.storeId, token),
          customerApi.getCustomersCreatedLastWeek(session.storeId, token),
        ]);
        setThisWeek(tw);
        setLastWeek(lw);
      } catch (error) {
        console.error('Failed to fetch customer segments:', error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [session, getValidToken]);

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

  const getRankColor = (rank?: string) => {
    switch (rank) {
      case 'Fashion': return 'bg-gradient-to-r from-gray-500 to-gray-400 text-white';
      case 'Fairytale': return 'bg-gradient-to-r from-yellow-500 to-amber-400 text-white';
      case 'Flower': return 'bg-gradient-to-r from-gray-400 to-gray-300 text-gray-800';
      case 'Family': return 'bg-gradient-to-r from-orange-600 to-orange-500 text-white';
      default: return 'bg-gray-200 text-gray-600';
    }
  };

  const storeId = session?.storeId ?? '';
  const thisWeekCustomers = thisWeek.map((s) => segmentToCustomer(s, storeId));
  const lastWeekCustomers = lastWeek.map((s) => segmentToCustomer(s, storeId));

  const kpis = [
    { label: 'This Week', value: thisWeek.length },
    { label: 'Last Week', value: lastWeek.length },
  ];

  const CustomerTable = ({ customers, title }: { customers: Customer[]; title: string }) => (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900">{title} <span className="text-gray-400 font-normal">({customers.length})</span></h2>
      </div>
      {customers.length === 0 ? (
        <p className="text-sm text-gray-400 py-4">No customers.</p>
      ) : (
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
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-500">{customer.email}</td>
                  <td className="py-3 px-4 text-sm text-gray-500">{new Date(customer.createdAt).toLocaleDateString()}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-block px-2.5 py-0.5 rounded-lg text-xs font-semibold ${getRankColor(customer.rank)}`}>
                      {customer.rank || '\u2014'}
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
      )}
    </Card>
  );

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

      <div className="grid grid-cols-2 gap-3 mb-8 max-w-md">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="text-center !p-4">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1">{kpi.label}</p>
            <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
          </Card>
        ))}
      </div>

      <div className="space-y-6">
        <CustomerTable customers={thisWeekCustomers} title="This Week" />
        <CustomerTable customers={lastWeekCustomers} title="Last Week" />
      </div>
    </div>
  );
}
