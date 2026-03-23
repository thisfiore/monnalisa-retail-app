import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Toggle } from '../components/Toggle';
import type { Child } from '../lib/types';
import { customerApi, ApiError } from '../lib/api-client';
import { fromGetResponse, toUpdateRequest } from '../lib/api-transforms';

export function CustomerEdit() {
  const { email: emailParam } = useParams<{ email: string }>();
  const decodedEmail = emailParam ? decodeURIComponent(emailParam) : '';
  const { session, getValidToken } = useAuth();
  const navigate = useNavigate();

  const [isLoadingData, setIsLoadingData] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneCountry, setPhoneCountry] = useState('+39');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('Italy');
  const [children, setChildren] = useState<Child[]>([]);
  const [loyaltyEnrollment, setLoyaltyEnrollment] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [_privacyConsent, setPrivacyConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  useEffect(() => {
    const fetchCustomer = async () => {
      if (!decodedEmail) { setLoadError('No email provided'); setIsLoadingData(false); return; }
      try {
        const token = await getValidToken();
        const accountResponse = await customerApi.getAccount(decodedEmail, token);
        const customerData = fromGetResponse(accountResponse);
        setFirstName(customerData.firstName ?? ''); setLastName(customerData.lastName ?? '');
        setDateOfBirth(customerData.dateOfBirth ?? ''); setLoyaltyEnrollment(customerData.loyaltyEnrollment ?? false);
        setMarketingConsent(customerData.marketingConsent ?? false); setPrivacyConsent(true);
        setChildren(customerData.children ?? []); setAddress(customerData.address ?? '');
        setCity(customerData.city ?? ''); setPostalCode(customerData.postalCode ?? '');
        setCountry(customerData.country ?? 'Italy');
        if (customerData.phone) {
          const phoneStr = customerData.phone;
          const knownPrefixes = ['+39', '+1', '+44', '+33', '+49', '+34', '+41', '+86', '+81'];
          const matchedPrefix = knownPrefixes.find(p => phoneStr.startsWith(p));
          if (matchedPrefix) { setPhoneCountry(matchedPrefix); setPhone(phoneStr.slice(matchedPrefix.length).trim()); }
          else { setPhone(phoneStr); }
        }
      } catch (error) { console.error('Failed to fetch customer:', error); setLoadError('Failed to load customer data'); }
      finally { setIsLoadingData(false); }
    };
    fetchCustomer();
  }, [decodedEmail, getValidToken]);

  const addChild = () => setChildren([...children, { name: '', birthDate: '', gender: undefined }]);
  const removeChild = (index: number) => setChildren(children.filter((_, i) => i !== index));
  const updateChild = (index: number, field: keyof Child, value: string) => {
    const updated = [...children];
    if (field === 'height' || field === 'shoeSize') updated[index] = { ...updated[index], [field]: value ? Number(value) : undefined };
    else updated[index] = { ...updated[index], [field]: value || undefined };
    setChildren(updated);
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!firstName.trim()) newErrors.firstName = 'First name is required';
    if (!lastName.trim()) newErrors.lastName = 'Last name is required';
    if (dateOfBirth && new Date(dateOfBirth) > new Date()) newErrors.dateOfBirth = 'Birth date cannot be in the future';
    children.forEach((child, index) => { if (child.birthDate && new Date(child.birthDate) > new Date()) newErrors[`child-${index}-birthDate`] = 'Birth date cannot be in the future'; });
    setErrors(newErrors); return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); setSubmitError(''); setSubmitSuccess(false);
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      const token = await getValidToken();
      const updateRequest = toUpdateRequest({ firstName, lastName, phone: phone ? `${phoneCountry} ${phone}` : undefined, dateOfBirth: dateOfBirth || undefined, address: address || undefined, city: city || undefined, postalCode: postalCode || undefined, country: country || undefined, loyaltyEnrollment, marketingConsent, children: children.length > 0 ? children : undefined });
      await customerApi.updateAccount(decodedEmail, updateRequest, token);
      setSubmitSuccess(true);
      setTimeout(() => navigate(`/customers/${encodeURIComponent(decodedEmail)}`), 1000);
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) setSubmitError('Validation error: please check the form fields');
      else setSubmitError(error instanceof Error ? error.message : 'Update failed');
    } finally { setIsSubmitting(false); }
  };

  if (isLoadingData) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex items-center gap-3 text-gray-400">
        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
        Loading...
      </div>
    </div>
  );

  if (loadError) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <p className="text-red-500">{loadError}</p>
      <Button onClick={() => navigate('/')}>Back to Dashboard</Button>
    </div>
  );

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const selectClass = 'px-3.5 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white hover:border-gray-400 text-gray-900 transition-colors';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
      <div className="sticky top-[52px] z-20 bg-[#f5f5f7]/95 backdrop-blur-sm border-b border-gray-200 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 mb-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button type="button" onClick={() => navigate(`/customers/${encodeURIComponent(decodedEmail)}`)} className="text-gray-400 hover:text-gray-600 shrink-0 transition-colors" aria-label="Back">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <h1 className="text-lg font-bold text-gray-900 truncate">Edit Customer</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button type="button" variant="outline" onClick={() => navigate(`/customers/${encodeURIComponent(decodedEmail)}`)} disabled={isSubmitting} className="text-sm px-3 py-1.5">Cancel</Button>
            <Button type="submit" form="edit-form" isLoading={isSubmitting} className="text-sm px-4 py-1.5">Save</Button>
          </div>
        </div>
        <div className="flex gap-1 mt-2 overflow-x-auto -mb-px">
          {[{ id: 'edit-identity', label: 'Identity' }, { id: 'edit-info', label: 'Info' }, { id: 'edit-children', label: 'Children' }, { id: 'edit-consents', label: 'Consents' }].map((s) => (
            <button key={s.id} type="button" onClick={() => scrollTo(s.id)} className="px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-gray-900 hover:bg-white rounded-lg transition-colors whitespace-nowrap">{s.label}</button>
          ))}
        </div>
      </div>

      <form id="edit-form" onSubmit={handleSubmit} className="space-y-5">
        <div id="edit-identity" className="scroll-mt-32" />
        <Card title="Customer Identity">
          <div className="bg-gray-50 p-4 rounded-xl mb-4">
            <p className="text-xs font-medium text-gray-400 mb-0.5">Email (read-only)</p>
            <p className="text-gray-900 font-medium">{decodedEmail}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">Phone {!phone && <span className="text-amber-500 font-normal">(missing)</span>}</label>
            <div className="flex gap-2">
              <select className={`w-28 ${selectClass} ${!phone ? 'border-amber-300 bg-amber-50' : ''}`} value={phoneCountry} onChange={(e) => setPhoneCountry(e.target.value)}>
                <option value="+39">+39</option><option value="+1">+1</option><option value="+44">+44</option><option value="+33">+33</option><option value="+49">+49</option><option value="+34">+34</option><option value="+41">+41</option><option value="+86">+86</option><option value="+81">+81</option>
              </select>
              <input type="tel" className={`flex-1 ${selectClass} placeholder:text-gray-400 placeholder:italic ${!phone ? 'border-amber-300 bg-amber-50' : ''}`} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} placeholder="123 4567890" />
            </div>
            {!phone && <p className="text-amber-500 text-sm mt-1">Please add a phone number.</p>}
          </div>
        </Card>

        <div id="edit-info" className="scroll-mt-32" />
        <Card title="Customer Information">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} error={errors.firstName} required />
            <Input label="Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)} error={errors.lastName} required />
            <Input label="Date of Birth" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} error={errors.dateOfBirth} />
          </div>
          <div className="mt-4"><Input label="Address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street address" /></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <Input label="City" value={city} onChange={(e) => setCity(e.target.value)} />
            <Input label="Postal Code" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">Country</label>
              <select className={`w-full ${selectClass}`} value={country} onChange={(e) => setCountry(e.target.value)}>
                <option value="Italy">Italy</option><option value="France">France</option><option value="Germany">Germany</option><option value="Spain">Spain</option><option value="Switzerland">Switzerland</option><option value="United Kingdom">United Kingdom</option><option value="United States">United States</option><option value="China">China</option><option value="Japan">Japan</option>
              </select>
            </div>
          </div>
        </Card>

        <div id="edit-children" className="scroll-mt-32" />
        <Card title="Children (Optional)">
          <div className="space-y-4">
            {children.map((child, index) => (
              <div key={index} className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3 overflow-hidden">
                <div className="flex items-center justify-between"><h4 className="font-medium text-gray-900 text-sm">Child {index + 1}</h4><button type="button" onClick={() => removeChild(index)} className="text-xs text-red-500 hover:text-red-700 transition-colors cursor-pointer">Remove</button></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 [&>*]:min-w-0">
                  <Input label="Name" value={child.name || ''} onChange={(e) => updateChild(index, 'name', e.target.value)} />
                  <Input label="Birth Date" type="date" value={child.birthDate || ''} onChange={(e) => updateChild(index, 'birthDate', e.target.value)} error={errors[`child-${index}-birthDate`]} />
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1.5">Gender</label>
                    <div className="flex gap-2">
                      {([{ value: 'male', label: 'Boy', icon: '\u2642', activeBg: 'bg-blue-50', activeBorder: 'border-blue-300', activeText: 'text-blue-700' }, { value: 'female', label: 'Girl', icon: '\u2640', activeBg: 'bg-pink-50', activeBorder: 'border-pink-300', activeText: 'text-pink-700' }] as const).map((option) => {
                        const isActive = child.gender === option.value;
                        return (<button key={option.value} type="button" onClick={() => updateChild(index, 'gender', isActive ? '' : option.value)} className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border transition-all text-sm font-medium ${isActive ? `${option.activeBg} ${option.activeBorder} ${option.activeText}` : 'border-gray-300 bg-white hover:border-gray-400 text-gray-500'}`}><span className="leading-none text-base">{option.icon}</span>{option.label}</button>);
                      })}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input label="Height (cm)" type="number" value={child.height != null ? String(child.height) : ''} onChange={(e) => updateChild(index, 'height', e.target.value)} placeholder="e.g. 120" />
                  <Input label="Shoe Size" type="number" value={child.shoeSize != null ? String(child.shoeSize) : ''} onChange={(e) => updateChild(index, 'shoeSize', e.target.value)} placeholder="e.g. 32" />
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={addChild} className="w-full">+ Add Child</Button>
          </div>
        </Card>

        <div id="edit-consents" className="scroll-mt-32" />
        <Card title="Consents">
          <div className="space-y-4">
            <Toggle label="Loyalty Program Enrollment" description="Toggling this on will trigger the double opt-in process." checked={loyaltyEnrollment} onChange={setLoyaltyEnrollment} />
            <Toggle label="Marketing Consent" description="Customer agrees to receive marketing communications" checked={marketingConsent} onChange={setMarketingConsent} />
            <Toggle label="Privacy Policy Consent" description="Implicit consent via double opt-in email." checked={true} onChange={() => {}} disabled />
          </div>
        </Card>

        <Card>
          <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Store</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-gray-400 text-xs">Store</p><p className="text-gray-900 font-medium">{session?.storeName}</p></div>
            <div><p className="text-gray-400 text-xs">Location</p><p className="text-gray-900 font-medium">{session?.storeAddress}</p></div>
            <div><p className="text-gray-400 text-xs">Store ID</p><p className="text-gray-900 font-medium">{session?.storeId}</p></div>
            <div><p className="text-gray-400 text-xs">Sales Associate</p><p className="text-gray-900 font-medium">{session?.salesAssociateId}</p></div>
          </div>
        </Card>

        {submitError && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{submitError}</div>}
        {submitSuccess && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm font-medium">Customer updated successfully!</div>}
      </form>

      <div className="mt-8 bg-white border border-gray-200 rounded-2xl p-6 text-center">
        {submitSuccess ? (
          <div>
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3"><svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></div>
            <p className="text-lg font-semibold text-gray-900 mb-1">Updated!</p>
            <p className="text-sm text-gray-400">Redirecting to profile...</p>
          </div>
        ) : submitError ? (
          <div><p className="text-sm text-red-600 mb-3">{submitError}</p><Button type="submit" form="edit-form" isLoading={isSubmitting} className="px-8">Try Again</Button></div>
        ) : (
          <div>
            <p className="text-sm text-gray-400 mb-3">Ready to save your changes?</p>
            <div className="flex items-center justify-center gap-3">
              <Button type="submit" form="edit-form" isLoading={isSubmitting} className="px-8">Save Changes</Button>
              <Button type="button" variant="outline" onClick={() => navigate(`/customers/${encodeURIComponent(decodedEmail)}`)} disabled={isSubmitting}>Cancel</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
