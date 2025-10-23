import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Input } from '../components/Input';
import type { Customer, Purchase } from '../lib/types';

// Mock data for profile view (since we don't have full backend)
const mockProfileData = {
  totalPoints: 1240,
  pendingPoints: 150,
  rank: 'Silver' as const,
  rankColor: '#C0C0C0',
  rewards: [
    { id: '1', name: 'Welcome Discount', description: '15% off your next purchase', available: true, used: false, consumable: true },
    { id: '2', name: 'Early Access Sale', description: 'Shop ahead of the crowd', available: true, used: false, consumable: false },
    { id: '3', name: '10% Birthday Discount', description: 'Valid during birthday month', available: true, used: false, consumable: false },
    { id: '4', name: 'Free Shipping', description: 'Used on October 10, 2025', available: false, used: true, consumable: true },
    { id: '5', name: 'VIP Event Access', description: 'Used on September 15, 2025', available: false, used: true, consumable: true },
  ],
  activities: [
    { id: '1', type: 'order', description: 'Order on ecommerce', date: '2025-10-15', points: 70 },
    { id: '2', type: 'order', description: 'Order in shop', date: '2025-09-28', points: 56 },
    { id: '3', type: 'event', description: 'Participated in M1D Event', date: '2025-09-10', points: 50 },
    { id: '4', type: 'order', description: 'Order in shop', date: '2025-08-12', points: 84 },
  ],
};

export function CustomerProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activities, setActivities] = useState(mockProfileData.activities);
  const [rewards, setRewards] = useState(mockProfileData.rewards);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newActivity, setNewActivity] = useState({
    type: 'event',
    description: '',
    points: 50,
  });
  const [preferences, setPreferences] = useState({
    gender: [] as string[],
    style: [] as string[],
    ageRange: [] as string[],
    notes: '',
  });
  const [showConsumedCoupons, setShowConsumedCoupons] = useState(false);

  useEffect(() => {
    const fetchCustomer = async () => {
      try {
        const customerResponse = await fetch(`/api/customers/${id}`);
        if (customerResponse.ok) {
          const customerData = await customerResponse.json();
          setCustomer(customerData);

          // Load preferences if available
          if (customerData.preferences) {
            setPreferences({
              gender: customerData.preferences.gender || [],
              style: customerData.preferences.style || [],
              ageRange: customerData.preferences.ageRange || [],
              notes: customerData.preferences.notes || '',
            });
          }

          // Fetch purchases
          const purchasesResponse = await fetch(`/api/customers/${id}/purchases`);
          if (purchasesResponse.ok) {
            const purchasesData = await purchasesResponse.json();
            setPurchases(purchasesData);
          }
        } else {
          setCustomer(null);
        }
      } catch (error) {
        console.error('Failed to fetch customer:', error);
        setCustomer(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCustomer();
  }, [id]);

  const handleAddActivity = () => {
    if (!newActivity.description.trim()) return;

    const activity = {
      id: String(activities.length + 1),
      type: newActivity.type as 'order' | 'event',
      description: newActivity.description,
      date: new Date().toISOString().split('T')[0],
      points: newActivity.points,
    };

    setActivities([activity, ...activities]);
    setIsModalOpen(false);
    setNewActivity({ type: 'event', description: '', points: 50 });
  };

  const handleUseReward = (rewardId: string) => {
    setRewards(rewards.map(r =>
      r.id === rewardId ? { ...r, used: true, available: false } : r
    ));
  };

  const togglePreferenceTag = (category: 'gender' | 'style' | 'ageRange', tag: string) => {
    setPreferences(prev => {
      const categoryTags = prev[category];
      const isSelected = categoryTags.includes(tag);

      return {
        ...prev,
        [category]: isSelected
          ? categoryTags.filter(t => t !== tag)
          : [...categoryTags, tag]
      };
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-red-600">Customer not found</p>
        <Button onClick={() => navigate('/')}>Back to Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Customer Profile</h1>
        <Button variant="outline" onClick={() => navigate('/')}>
          Back to Dashboard
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer Info & Points */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <div className="text-center">
              <img
                src="/woman.png"
                alt={`${customer.firstName} ${customer.lastName}`}
                className="w-24 h-24 rounded-full mx-auto mb-4 object-cover border-4 border-pink-200"
              />
              <h2 className="text-2xl font-bold text-gray-900">
                {customer.firstName} {customer.lastName}
              </h2>
              <p className="text-gray-600 text-sm mt-1">{customer.email}</p>
              {customer.phone && <p className="text-gray-500 text-sm">{customer.phone}</p>}
            </div>

            <div className="mt-6 pt-6 border-t space-y-6">
              {/* Purchase Stats */}
              {customer.totalPurchases !== undefined && customer.totalSpent !== undefined && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-blue-50 p-3 rounded-lg text-center">
                    <p className="text-2xl font-bold text-blue-600">{customer.totalPurchases}</p>
                    <p className="text-xs text-blue-800 mt-1">Total Purchases</p>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg text-center">
                    <p className="text-2xl font-bold text-green-600">€{customer.totalSpent.toFixed(0)}</p>
                    <p className="text-xs text-green-800 mt-1">Total Spent</p>
                  </div>
                </div>
              )}

              {/* Unified Rank & Points Progress */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <p className="text-sm font-medium text-gray-700">Rank Progress</p>
                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-900">{mockProfileData.totalPoints} pts</p>
                    <p className="text-xs text-orange-600">+{mockProfileData.pendingPoints} pending</p>
                  </div>
                </div>

                {/* Rank Milestones */}
                {(() => {
                  const ranks = [
                    { name: 'Bronze', threshold: 0, gradient: 'from-orange-700 via-amber-600 to-orange-800', color: 'bg-orange-600' },
                    { name: 'Silver', threshold: 500, gradient: 'from-slate-400 via-gray-300 to-slate-500', color: 'bg-slate-400' },
                    { name: 'Gold', threshold: 1000, gradient: 'from-yellow-500 via-amber-400 to-yellow-600', color: 'bg-yellow-500' },
                    { name: 'Platinum', threshold: 2000, gradient: 'from-slate-200 via-gray-100 to-slate-300', color: 'bg-slate-300' },
                  ];

                  const maxPoints = 3000; // Display range
                  const totalPoints = mockProfileData.totalPoints;
                  const totalWithPending = totalPoints + mockProfileData.pendingPoints;

                  // Find current rank
                  const currentRankIndex = ranks.findIndex((r, i) =>
                    totalPoints >= r.threshold && (i === ranks.length - 1 || totalPoints < ranks[i + 1].threshold)
                  );

                  return (
                    <>
                      {/* Progress Bar */}
                      <div className="relative h-8 bg-gray-200 rounded-full overflow-hidden">
                        {/* Rank segments background */}
                        {ranks.map((rank, index) => {
                          const nextThreshold = index < ranks.length - 1 ? ranks[index + 1].threshold : maxPoints;
                          const segmentWidth = ((nextThreshold - rank.threshold) / maxPoints) * 100;
                          const isActive = index <= currentRankIndex;

                          return (
                            <div
                              key={rank.name}
                              className={`absolute h-full ${isActive ? `bg-gradient-to-r ${rank.gradient} opacity-30` : ''}`}
                              style={{
                                left: `${(rank.threshold / maxPoints) * 100}%`,
                                width: `${segmentWidth}%`,
                              }}
                            />
                          );
                        })}

                        {/* Current progress fill */}
                        <div
                          className={`absolute h-full bg-gradient-to-r ${ranks[currentRankIndex].gradient} shadow-inner`}
                          style={{ width: `${Math.min((totalPoints / maxPoints) * 100, 100)}%` }}
                        />

                        {/* Pending points overlay */}
                        <div
                          className="absolute h-full bg-orange-400 opacity-40"
                          style={{
                            left: `${Math.min((totalPoints / maxPoints) * 100, 100)}%`,
                            width: `${Math.min((mockProfileData.pendingPoints / maxPoints) * 100, 100 - (totalPoints / maxPoints) * 100)}%`,
                          }}
                        />

                        {/* Current position marker */}
                        <div
                          className="absolute top-0 bottom-0 w-1 bg-white shadow-lg"
                          style={{ left: `${Math.min((totalPoints / maxPoints) * 100, 100)}%` }}
                        />
                      </div>

                      {/* Rank labels */}
                      <div className="relative mt-2 pb-12">
                        {ranks.map((rank) => (
                          <div
                            key={rank.name}
                            className="absolute transform -translate-x-1/2"
                            style={{ left: `${(rank.threshold / maxPoints) * 100}%` }}
                          >
                            <div className="flex flex-col items-center">
                              <div className={`w-2 h-2 rounded-full ${rank.color} mb-1`}></div>
                              <span className="text-xs font-semibold text-gray-700">{rank.name}</span>
                              <span className="text-xs text-gray-500">{rank.threshold}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Current rank badge */}
                      <div className="mt-4 text-center">
                        <div className={`inline-block px-6 py-3 rounded-lg bg-gradient-to-r ${ranks[currentRankIndex].gradient} shadow-lg`}>
                          <p className="text-xs text-white font-medium mb-1">Current Rank</p>
                          <p className="text-2xl font-bold text-white">{ranks[currentRankIndex].name}</p>
                        </div>
                        {currentRankIndex < ranks.length - 1 && (
                          <p className="text-xs text-gray-600 mt-2">
                            {ranks[currentRankIndex + 1].threshold - totalPoints} points to {ranks[currentRankIndex + 1].name}
                          </p>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </Card>

          {/* Children */}
          {customer.children && customer.children.length > 0 && (
            <Card title="Children">
              <div className="space-y-3">
                {customer.children.map((child, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <img
                      src={index % 2 === 0 ? '/kid-1.png' : '/kid-2.png'}
                      alt={child.name || 'Child'}
                      className="w-12 h-12 rounded-full object-cover border-2 border-blue-200"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{child.name || 'Child'}</p>
                      {child.birthDate && (
                        <p className="text-sm text-gray-500">
                          Born {new Date(child.birthDate).toLocaleDateString()}
                        </p>
                      )}
                      {child.gender && (
                        <p className="text-xs text-gray-400 capitalize">{child.gender}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Preferences */}
          <Card title="Preferences">
            <div className="space-y-4">
              {/* Gender */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Gender</p>
                <div className="flex flex-wrap gap-2">
                  {['Boy', 'Girl', 'Unisex'].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => togglePreferenceTag('gender', tag)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                        preferences.gender.includes(tag)
                          ? 'bg-blue-500 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Style */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Style</p>
                <div className="flex flex-wrap gap-2">
                  {['Casual', 'Formal', 'Sporty', 'Elegant', 'Vintage', 'Modern'].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => togglePreferenceTag('style', tag)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                        preferences.style.includes(tag)
                          ? 'bg-purple-500 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Age Range */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Age Range</p>
                <div className="flex flex-wrap gap-2">
                  {['Newborn', 'Kid', 'Teen'].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => togglePreferenceTag('ageRange', tag)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                        preferences.ageRange.includes(tag)
                          ? 'bg-green-500 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Notes</p>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  rows={3}
                  placeholder="Add custom notes about customer preferences..."
                  value={preferences.notes}
                  onChange={(e) => setPreferences(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Rewards */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Available Rewards & Coupons</h2>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showConsumedCoupons}
                  onChange={(e) => setShowConsumedCoupons(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Show consumed</span>
              </label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rewards
                .filter(reward => showConsumedCoupons || !reward.used)
                .map((reward) => (
                <div key={reward.id} className={`border rounded-lg p-4 ${
                  reward.used ? 'border-gray-300 bg-gray-50' :
                  reward.consumable ? 'border-orange-200 bg-orange-50' : 'border-blue-200 bg-blue-50'
                }`}>
                  <div className="flex items-start justify-between mb-2">
                    <h3 className={`font-semibold ${
                      reward.used ? 'text-gray-500' :
                      reward.consumable ? 'text-orange-900' : 'text-blue-900'
                    }`}>
                      {reward.name}
                    </h3>
                    {!reward.used && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        reward.consumable
                          ? 'bg-orange-200 text-orange-800'
                          : 'bg-blue-200 text-blue-800'
                      }`}>
                        {reward.consumable ? 'One-time' : 'Permanent'}
                      </span>
                    )}
                  </div>
                  <p className={`text-sm mt-1 ${
                    reward.used ? 'text-gray-400' :
                    reward.consumable ? 'text-orange-700' : 'text-blue-700'
                  }`}>
                    {reward.description}
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    {reward.used ? (
                      <span className="inline-block text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full">
                        Consumed
                      </span>
                    ) : (
                      <>
                        <span className="inline-block text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                          Available
                        </span>
                        {reward.consumable && (
                          <Button
                            variant="primary"
                            onClick={() => handleUseReward(reward.id)}
                            className="text-xs py-1 px-3 ml-auto"
                          >
                            Use Now
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Previous Purchases */}
          <Card title="Previous Purchases">
            {purchases.length > 0 ? (
              <div className="space-y-3">
                {purchases.map((purchase) => (
                  <div key={purchase.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">€{purchase.amount.toFixed(2)}</p>
                      <p className="text-sm text-gray-600">{purchase.items.join(', ')}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(purchase.date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No purchases yet</p>
            )}
          </Card>

          {/* Activities */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Activity History</h2>
              <Button variant="outline" onClick={() => setIsModalOpen(true)} className="text-sm">
                + Add Activity
              </Button>
            </div>
            <div className="space-y-3">
              {activities.map((activity) => (
                <div key={activity.id} className="flex items-center gap-4 p-3 border-l-4 border-blue-400 bg-gray-50 rounded">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                      activity.type === 'order' ? 'bg-green-500' : 'bg-purple-500'
                    }`}
                  >
                    {activity.type === 'order' ? '🛍️' : '🎉'}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{activity.description}</p>
                    <p className="text-sm text-gray-600">{new Date(activity.date).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-green-600 font-semibold">+{activity.points} pts</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Add Activity Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Event Activity">
        <div className="space-y-4">
          <Input
            label="Event Name"
            placeholder="e.g., M1D Event, Fashion Week, Store Opening"
            value={newActivity.description}
            onChange={(e) => setNewActivity({ ...newActivity, description: e.target.value })}
            required
          />

          <Input
            label="Points"
            type="number"
            value={newActivity.points}
            onChange={(e) => setNewActivity({ ...newActivity, points: parseInt(e.target.value) || 0 })}
            required
          />

          <div className="flex gap-2 pt-4">
            <Button onClick={handleAddActivity} className="flex-1">
              Add Event
            </Button>
            <Button variant="outline" onClick={() => setIsModalOpen(false)} className="flex-1">
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
