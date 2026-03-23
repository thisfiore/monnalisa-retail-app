import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Input } from '../components/Input';
import { useAuth } from '../lib/auth';
import { customerApi } from '../lib/api-client';
import { fromGetResponse } from '../lib/api-transforms';
import type { Customer } from '../lib/types';
import type { LoyaltyPointLedgerEntry } from '../lib/api-types';

type Activity = {
  id: string;
  type: 'order' | 'event';
  description: string;
  date: string;
  points: number;
};

const mockRewards = [
  { id: '1', name: 'Welcome Discount', description: '15% off your next purchase', available: true, used: false, consumable: true },
  { id: '2', name: 'Early Access Sale', description: 'Shop ahead of the crowd', available: true, used: false, consumable: false },
  { id: '3', name: '10% Birthday Discount', description: 'Valid during birthday month', available: true, used: false, consumable: false },
  { id: '4', name: 'Free Shipping', description: 'Used on October 10, 2025', available: false, used: true, consumable: true },
  { id: '5', name: 'VIP Event Access', description: 'Used on September 15, 2025', available: false, used: true, consumable: true },
];

function mapLedgerToActivities(records: LoyaltyPointLedgerEntry[]): Activity[] {
  return records.map((entry, index) => ({
    id: String(index + 1),
    type: (entry.AppliedRules__c?.toLowerCase().includes('event') ? 'event' : 'order') as 'order' | 'event',
    description: entry.AppliedRules__c || 'Loyalty transaction',
    date: entry.OperationDate__c || '',
    points: entry.Points__c || 0,
  }));
}

export function CustomerProfile() {
  const { email: emailParam } = useParams<{ email: string }>();
  const decodedEmail = emailParam ? decodeURIComponent(emailParam) : '';
  const navigate = useNavigate();
  const { getValidToken } = useAuth();

  const [customer, setCustomer] = useState<Partial<Customer> | null>(null);
  const [totalPoints, setTotalPoints] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [rewards, setRewards] = useState(mockRewards);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newActivity, setNewActivity] = useState({ type: 'event', description: '', points: 50 });
  const [showConsumedCoupons, setShowConsumedCoupons] = useState(false);

  const isLoyaltyMember = customer?.loyaltyEnrollment === true;

  useEffect(() => {
    const fetchCustomer = async () => {
      if (!decodedEmail) { setIsLoading(false); return; }
      try {
        const token = await getValidToken();
        const accountResponse = await customerApi.getAccount(decodedEmail, token);
        const customerData = fromGetResponse(accountResponse);
        setCustomer(customerData);
        setTotalPoints(accountResponse.TotalQualifyingPoints__c ?? 0);
        if (accountResponse.LoyaltyConsent__c) {
          try {
            const ledgerResponse = await customerApi.getLoyaltyLedger(decodedEmail, token);
            setActivities(mapLedgerToActivities(ledgerResponse.records));
          } catch (error) { console.error('Failed to fetch loyalty ledger:', error); setActivities([]); }
        }
      } catch (error) { console.error('Failed to fetch customer:', error); setCustomer(null); }
      finally { setIsLoading(false); }
    };
    fetchCustomer();
  }, [decodedEmail, getValidToken]);

  const handleAddActivity = () => {
    if (!newActivity.description.trim()) return;
    const activity: Activity = { id: String(activities.length + 1), type: newActivity.type as 'order' | 'event', description: newActivity.description, date: new Date().toISOString().split('T')[0], points: newActivity.points };
    setActivities([activity, ...activities]);
    setIsModalOpen(false);
    setNewActivity({ type: 'event', description: '', points: 50 });
  };

  const handleUseReward = (rewardId: string) => {
    setRewards(rewards.map(r => r.id === rewardId ? { ...r, used: true, available: false } : r));
  };

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex items-center gap-3 text-gray-400">
        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
        Loading...
      </div>
    </div>
  );

  if (!customer) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <p className="text-red-500">Customer not found</p>
      <Button onClick={() => navigate('/')}>Back to Dashboard</Button>
    </div>
  );

  const rankValue = customer.rank || 'Family';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate('/')} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Customer Profile</h1>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate(`/customers/${encodeURIComponent(decodedEmail)}/edit`)}>Edit</Button>
          <Button variant="outline" onClick={() => navigate('/')}>Dashboard</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-1 space-y-5">
          <Card>
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-pink-100 to-purple-100 mx-auto mb-4 flex items-center justify-center text-2xl font-bold text-pink-600">
                {(customer.firstName?.[0] || '').toUpperCase()}{(customer.lastName?.[0] || '').toUpperCase()}
              </div>
              <h2 className="text-xl font-bold text-gray-900">{customer.firstName} {customer.lastName}</h2>
              <p className="text-gray-500 text-sm mt-1">{customer.email}</p>
              {customer.phone && <p className="text-gray-400 text-sm">{customer.phone}</p>}
              {customer.dateOfBirth && <p className="text-gray-400 text-sm mt-1">Born {new Date(customer.dateOfBirth).toLocaleDateString()}</p>}
            </div>

            {isLoyaltyMember ? (
              <div className="mt-6 pt-6 border-t border-gray-200 space-y-5">
                {customer.loyaltyDoubleOptIn === false && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                    <p className="text-amber-800 text-sm font-medium">Opt-in pending verification</p>
                    <p className="text-amber-600 text-xs mt-0.5">Double opt-in email sent</p>
                  </div>
                )}

                <div>
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-sm font-medium text-gray-600">Rank Progress</p>
                    <p className="text-lg font-bold text-gray-900">{totalPoints} pts</p>
                  </div>

                  {(() => {
                    const ranks = [
                      { name: 'Family', threshold: 0, gradient: 'from-orange-700 via-amber-600 to-orange-800', color: 'bg-orange-600' },
                      { name: 'Flower', threshold: 500, gradient: 'from-slate-400 via-gray-300 to-slate-500', color: 'bg-slate-400' },
                      { name: 'Fairytale', threshold: 1000, gradient: 'from-yellow-500 via-amber-400 to-yellow-600', color: 'bg-yellow-500' },
                      { name: 'Fashion', threshold: 2000, gradient: 'from-slate-200 via-gray-100 to-slate-300', color: 'bg-slate-300' },
                    ];
                    const maxPoints = 3000;
                    const currentRankIndex = ranks.findIndex((r, i) => totalPoints >= r.threshold && (i === ranks.length - 1 || totalPoints < ranks[i + 1].threshold));
                    const safeRankIndex = currentRankIndex >= 0 ? currentRankIndex : 0;

                    return (
                      <>
                        <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden">
                          <div className={`absolute h-full bg-gradient-to-r ${ranks[safeRankIndex].gradient} rounded-full transition-all`} style={{ width: `${Math.min((totalPoints / maxPoints) * 100, 100)}%` }} />
                        </div>
                        <div className="flex justify-between mt-2">
                          {ranks.map((rank) => (
                            <div key={rank.name} className="text-center">
                              <div className={`w-2 h-2 rounded-full ${rank.color} mx-auto mb-0.5`} />
                              <span className="text-[10px] font-medium text-gray-500">{rank.name}</span>
                            </div>
                          ))}
                        </div>
                        <div className="mt-4 text-center">
                          <div className={`inline-block px-5 py-2.5 rounded-xl bg-gradient-to-r ${ranks[safeRankIndex].gradient}`}>
                            <p className="text-[10px] text-white/80 font-medium uppercase tracking-wider">Current Rank</p>
                            <p className="text-xl font-bold text-white">{rankValue}</p>
                          </div>
                          {safeRankIndex < ranks.length - 1 && (
                            <p className="text-xs text-gray-400 mt-2">{ranks[safeRankIndex + 1].threshold - totalPoints} pts to {ranks[safeRankIndex + 1].name}</p>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            ) : (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="bg-gradient-to-br from-pink-50 to-purple-50 border border-pink-200 rounded-xl p-5 text-center">
                  <div className="text-3xl mb-2">&#11088;</div>
                  <h3 className="text-base font-semibold text-gray-900 mb-1">Join Monnalisa Loyalty</h3>
                  <p className="text-sm text-gray-500 mb-4">Enroll to unlock points, rewards, and exclusive benefits.</p>
                  <Button onClick={() => navigate(`/customers/${encodeURIComponent(decodedEmail)}/edit`)} className="w-full">Enroll Now</Button>
                </div>
              </div>
            )}
          </Card>

          {customer.children && customer.children.length > 0 && (
            <Card title="Children">
              <div className="space-y-2.5">
                {customer.children.map((child, index) => {
                  let ageLabel: string | null = null;
                  if (child.birthDate) {
                    const birth = new Date(child.birthDate);
                    const now = new Date();
                    let years = now.getFullYear() - birth.getFullYear();
                    let months = now.getMonth() - birth.getMonth();
                    if (now.getDate() < birth.getDate()) months--;
                    if (months < 0) { years--; months += 12; }
                    ageLabel = years > 0 ? `${years}y ${months}m` : `${months}m`;
                  }
                  const isBoy = child.gender === 'male';
                  const cardBg = isBoy ? 'bg-blue-50 border-blue-200' : 'bg-pink-50 border-pink-200';
                  const circleBg = isBoy ? 'bg-blue-200 text-blue-700' : 'bg-pink-200 text-pink-700';
                  const ageColor = isBoy ? 'text-blue-700' : 'text-pink-700';
                  const pillStyle = isBoy ? 'border-blue-200 text-blue-800' : 'border-pink-200 text-pink-800';

                  return (
                    <div key={index} className={`flex items-start gap-3 p-3 border rounded-xl ${cardBg}`}>
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${circleBg}`}>
                        {child.gender === 'female' ? '\u2640' : child.gender === 'male' ? '\u2642' : '\u2727'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm">{child.name || 'Unnamed'}</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs text-gray-500">
                          {ageLabel && <span className={`font-semibold ${ageColor}`}>{ageLabel}</span>}
                          {child.birthDate && <span>{new Date(child.birthDate).toLocaleDateString()}</span>}
                        </div>
                        {(child.height || child.shoeSize) && (
                          <div className="flex gap-2 mt-1.5">
                            {child.height != null && <span className={`inline-flex items-center text-xs bg-white border rounded-full px-2 py-0.5 ${pillStyle}`}>{child.height} cm</span>}
                            {child.shoeSize != null && <span className={`inline-flex items-center text-xs bg-white border rounded-full px-2 py-0.5 ${pillStyle}`}>Shoe {child.shoeSize}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>

        {/* Right Column */}
        <div className="lg:col-span-2 space-y-5">
          {isLoyaltyMember ? (
            <>
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-gray-900">Rewards & Coupons</h2>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={showConsumedCoupons} onChange={(e) => setShowConsumedCoupons(e.target.checked)} className="w-4 h-4 text-gray-900 rounded border-gray-300 focus:ring-gray-900" />
                    <span className="text-xs text-gray-500">Show used</span>
                  </label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {rewards.filter(r => showConsumedCoupons || !r.used).map((reward) => (
                    <div key={reward.id} className={`border rounded-xl p-4 ${reward.used ? 'border-gray-200 bg-gray-50' : reward.consumable ? 'border-orange-200 bg-orange-50/50' : 'border-blue-200 bg-blue-50/50'}`}>
                      <div className="flex items-start justify-between mb-1.5">
                        <h3 className={`font-semibold text-sm ${reward.used ? 'text-gray-400' : reward.consumable ? 'text-orange-900' : 'text-blue-900'}`}>{reward.name}</h3>
                        {!reward.used && <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${reward.consumable ? 'bg-orange-200 text-orange-800' : 'bg-blue-200 text-blue-800'}`}>{reward.consumable ? 'One-time' : 'Permanent'}</span>}
                      </div>
                      <p className={`text-xs mt-0.5 ${reward.used ? 'text-gray-400' : reward.consumable ? 'text-orange-700' : 'text-blue-700'}`}>{reward.description}</p>
                      <div className="flex items-center gap-2 mt-2.5">
                        {reward.used ? (
                          <span className="text-[10px] bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">Consumed</span>
                        ) : (
                          <>
                            <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Available</span>
                            {reward.consumable && <Button onClick={() => handleUseReward(reward.id)} className="text-xs py-1 px-3 ml-auto">Use</Button>}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card title="Previous Purchases">
                <p className="text-gray-400 text-center py-8 text-sm">Coming soon</p>
              </Card>

              <Card>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-gray-900">Activity History</h2>
                  <Button variant="outline" onClick={() => setIsModalOpen(true)} className="text-xs">+ Add Activity</Button>
                </div>
                {activities.length > 0 ? (
                  <div className="space-y-2">
                    {activities.map((activity) => (
                      <div key={activity.id} className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 ${activity.type === 'order' ? 'bg-green-500' : 'bg-purple-500'}`}>
                          {activity.type === 'order' ? '\uD83D\uDECD\uFE0F' : '\uD83C\uDF89'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 text-sm">{activity.description}</p>
                          {activity.date && <p className="text-xs text-gray-400">{new Date(activity.date).toLocaleDateString()}</p>}
                        </div>
                        <p className={`font-semibold text-sm ${activity.points >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {activity.points >= 0 ? '+' : ''}{activity.points} pts
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-center py-8 text-sm">No activity yet</p>
                )}
              </Card>
            </>
          ) : (
            <>
              <Card title="Previous Purchases">
                <p className="text-gray-400 text-center py-8 text-sm">Coming soon</p>
              </Card>
              <Card>
                <div className="text-center py-8">
                  <p className="text-gray-400 text-sm">Loyalty features available after enrollment.</p>
                  <p className="text-xs text-gray-300 mt-1">Edit profile to enroll in the loyalty program.</p>
                </div>
              </Card>
            </>
          )}
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Event Activity">
        <div className="space-y-4">
          <Input label="Event Name" placeholder="e.g., M1D Event, Fashion Week" value={newActivity.description} onChange={(e) => setNewActivity({ ...newActivity, description: e.target.value })} required />
          <Input label="Points" type="number" value={newActivity.points} onChange={(e) => setNewActivity({ ...newActivity, points: parseInt(e.target.value) || 0 })} required />
          <div className="flex gap-2 pt-2">
            <Button onClick={handleAddActivity} className="flex-1">Add Event</Button>
            <Button variant="outline" onClick={() => setIsModalOpen(false)} className="flex-1">Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
