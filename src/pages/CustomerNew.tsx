import { useState, useEffect, useRef } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Toggle } from '../components/Toggle';
import type { Child } from '../lib/types';
import { customerApi, ApiError } from '../lib/api-client';
import { toCreateRequest, toUpdateRequest, formatPhoneE164 } from '../lib/api-transforms';

type ValidationStatus = 'idle' | 'checking' | 'valid' | 'invalid';

interface ExistingCustomerInfo {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
}

export function CustomerNew() {
  const { session, getValidToken } = useAuth();
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneCountry, setPhoneCountry] = useState('+39');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('Italy');
  const [children, setChildren] = useState<Child[]>([]);
  const [loyaltyEnrollment, setLoyaltyEnrollment] = useState(true);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [_privacyConsent, setPrivacyConsent] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitErrorCustomer, setSubmitErrorCustomer] = useState<ExistingCustomerInfo | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const [emailValidation, setEmailValidation] = useState<ValidationStatus>('idle');
  const [, setEmailMessage] = useState('');
  const [existingEmailCustomer, setExistingEmailCustomer] = useState<ExistingCustomerInfo | null>(null);
  const emailTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [phoneValidation, setPhoneValidation] = useState<ValidationStatus>('idle');
  const [, setPhoneMessage] = useState('');
  const [existingPhoneCustomer, setExistingPhoneCustomer] = useState<ExistingCustomerInfo | null>(null);
  const phoneTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Email validation effect
  useEffect(() => {
    if (emailTimeoutRef.current) clearTimeout(emailTimeoutRef.current);
    if (!email || !email.trim()) { setEmailValidation('idle'); setEmailMessage(''); setExistingEmailCustomer(null); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setEmailValidation('idle'); setEmailMessage(''); setExistingEmailCustomer(null); return; }

    setEmailValidation('checking');
    setEmailMessage('');

    emailTimeoutRef.current = setTimeout(async () => {
      try {
        const token = await getValidToken();
        const result = await customerApi.checkEmailExists(email, token);
        if (!result.exists) {
          setEmailValidation('valid'); setEmailMessage(''); setExistingEmailCustomer(null);
        } else {
          setEmailValidation('invalid');
          setEmailMessage('A customer with this email already exists.');
          try {
            const account = await customerApi.getAccount(email, token);
            setExistingEmailCustomer({ id: account.Id ?? '', firstName: account.FirstName ?? '', lastName: account.LastName ?? '', email: account.EmailKey__c ?? email });
          } catch {
            setExistingEmailCustomer({ id: '', firstName: '', lastName: 'Existing customer', email });
          }
        }
      } catch (error) {
        console.error('Email validation error:', error);
        setEmailValidation('idle');
      }
    }, 500);
  }, [email, getValidToken]);

  // Phone validation effect
  useEffect(() => {
    if (phoneTimeoutRef.current) clearTimeout(phoneTimeoutRef.current);
    if (!phone || !phone.trim()) { setPhoneValidation('idle'); setPhoneMessage(''); setExistingPhoneCustomer(null); return; }
    if (phone.length < 6) { setPhoneValidation('idle'); setPhoneMessage(''); setExistingPhoneCustomer(null); return; }

    setPhoneValidation('checking');
    setPhoneMessage('');

    phoneTimeoutRef.current = setTimeout(async () => {
      try {
        const token = await getValidToken();
        const fullPhone = `${phoneCountry} ${phone}`;
        const normalizedPhone = formatPhoneE164(fullPhone);
        const result = await customerApi.checkPhoneExists(normalizedPhone, token);
        if (!result.exists) {
          setPhoneValidation('valid'); setPhoneMessage(''); setExistingPhoneCustomer(null);
        } else {
          setPhoneValidation('invalid');
          setPhoneMessage('A customer with this phone number already exists.');
          try {
            const searchResults = await customerApi.search(normalizedPhone, token, 1);
            if (searchResults.length > 0) {
              const match = searchResults[0];
              setExistingPhoneCustomer({ id: '', firstName: match.Name?.split(' ')[0] ?? '', lastName: match.Name?.split(' ').slice(1).join(' ') ?? '', email: match.EmailKey__c ?? undefined, phone: match.Phone ?? normalizedPhone });
            } else { setExistingPhoneCustomer(null); }
          } catch { setExistingPhoneCustomer(null); }
        }
      } catch (error) {
        console.error('Phone validation error:', error);
        setPhoneValidation('idle');
      }
    }, 500);
  }, [phone, phoneCountry, getValidToken]);

  const addChild = () => setChildren([...children, { name: '', birthDate: '', gender: undefined }]);
  const removeChild = (index: number) => setChildren(children.filter((_, i) => i !== index));
  const updateChild = (index: number, field: keyof Child, value: string) => {
    const updated = [...children];
    if (field === 'height' || field === 'shoeSize') {
      updated[index] = { ...updated[index], [field]: value ? Number(value) : undefined };
    } else {
      updated[index] = { ...updated[index], [field]: value || undefined };
    }
    setChildren(updated);
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!firstName.trim()) newErrors.firstName = 'First name is required';
    if (!lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!email.trim()) { newErrors.email = 'Email is required'; }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { newErrors.email = 'Invalid email format'; }
    else if (emailValidation === 'invalid') { newErrors.email = 'This email is already registered'; }
    if (phone && phoneValidation === 'invalid') newErrors.phone = 'This phone number is already registered';
    if (dateOfBirth && new Date(dateOfBirth) > new Date()) newErrors.dateOfBirth = 'Birth date cannot be in the future';
    children.forEach((child, index) => {
      if (child.birthDate && new Date(child.birthDate) > new Date()) newErrors[`child-${index}-birthDate`] = 'Birth date cannot be in the future';
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(''); setSubmitErrorCustomer(null); setSubmitSuccess(false);
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      const token = await getValidToken();
      const customerData = { firstName, lastName, email, phone: phone ? `${phoneCountry} ${phone}` : undefined, dateOfBirth: dateOfBirth || undefined, loyaltyEnrollment, marketingConsent, privacyConsent: true, children: children.length > 0 ? children : undefined };
      const createRequest = toCreateRequest(customerData);
      await customerApi.createAccount(createRequest, token);
      if (address || city || postalCode || country !== 'Italy') {
        const addressUpdate = toUpdateRequest({ address: address || undefined, city: city || undefined, postalCode: postalCode || undefined, country: country || undefined });
        await customerApi.updateAccount(email, addressUpdate, token);
      }
      setSubmitSuccess(true);
      setTimeout(() => navigate(`/customers/${encodeURIComponent(email)}`), 1000);
    } catch (error) {
      if (error instanceof ApiError && error.status === 500) {
        setSubmitError('A customer with this email may already exist.');
        try {
          const token = await getValidToken();
          const account = await customerApi.getAccount(email, token);
          setSubmitErrorCustomer({ id: account.Id ?? '', firstName: account.FirstName ?? '', lastName: account.LastName ?? '', email: account.EmailKey__c ?? email });
        } catch { setSubmitErrorCustomer(null); }
      } else if (error instanceof ApiError && error.status === 422) {
        setSubmitError('Validation error: please check the form fields');
      } else {
        setSubmitError(error instanceof Error ? error.message : 'Registration failed');
      }
    } finally { setIsSubmitting(false); }
  };

  const resetForm = () => {
    setFirstName(''); setLastName(''); setEmail(''); setPhoneCountry('+39'); setPhone('');
    setDateOfBirth(''); setAddress(''); setCity(''); setPostalCode(''); setCountry('Italy');
    setChildren([]); setLoyaltyEnrollment(true); setMarketingConsent(false); setPrivacyConsent(false);
    setErrors({}); setEmailValidation('idle'); setEmailMessage(''); setExistingEmailCustomer(null);
    setPhoneValidation('idle'); setPhoneMessage(''); setExistingPhoneCustomer(null);
  };

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const selectClass = 'px-3.5 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white hover:border-gray-400 text-gray-900 transition-colors';

  const Spinner = () => (
    <svg className="w-3.5 h-3.5 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );

  const Check = () => (
    <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
      {/* Sticky top bar */}
      <div className="sticky top-[52px] z-20 bg-[#f5f5f7]/95 backdrop-blur-sm border-b border-gray-200 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 mb-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button type="button" onClick={() => navigate('/')} className="text-gray-400 hover:text-gray-600 shrink-0 transition-colors" aria-label="Back">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <h1 className="text-lg font-bold text-gray-900 truncate">New Customer</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button type="button" variant="outline" onClick={resetForm} disabled={isSubmitting} className="text-sm px-3 py-1.5">Clear</Button>
            <Button type="submit" form="register-form" isLoading={isSubmitting} className="text-sm px-4 py-1.5">Register</Button>
          </div>
        </div>
        <div className="flex gap-1 mt-2 overflow-x-auto -mb-px">
          {[{ id: 'section-identity', label: 'Identity' }, { id: 'section-info', label: 'Info' }, { id: 'section-children', label: 'Children' }, { id: 'section-consents', label: 'Consents' }].map((s) => (
            <button key={s.id} type="button" onClick={() => scrollTo(s.id)} className="px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-gray-900 hover:bg-white rounded-lg transition-colors whitespace-nowrap">{s.label}</button>
          ))}
        </div>
      </div>

      <form id="register-form" onSubmit={handleSubmit} className="space-y-5">
        {/* Step 1 */}
        <div id="section-identity" className="scroll-mt-32" />
        <Card>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-black text-white text-xs font-bold">1</span>
            <h2 className="text-lg font-semibold text-gray-900">Verify Identity</h2>
          </div>
          <p className="text-sm text-gray-400 mb-5 ml-8">Check if the customer already exists.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} required />
              {emailValidation === 'checking' && <p className="text-gray-400 text-sm mt-1.5 flex items-center gap-1.5"><Spinner /> Checking...</p>}
              {emailValidation === 'valid' && email && <p className="text-green-600 text-sm mt-1.5 flex items-center gap-1"><Check /> Available</p>}
              {emailValidation === 'invalid' && existingEmailCustomer && (
                <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-amber-800">Already exists</p>
                    <p className="text-xs text-amber-600 truncate">{existingEmailCustomer.firstName} {existingEmailCustomer.lastName}</p>
                  </div>
                  <Button type="button" onClick={() => navigate(`/customers/${encodeURIComponent(existingEmailCustomer.email || email)}`)} className="shrink-0 text-xs px-3 py-1.5">Open</Button>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">Phone</label>
              <div className="flex gap-2">
                <select className={`w-28 ${selectClass}`} value={phoneCountry} onChange={(e) => setPhoneCountry(e.target.value)}>
                  <option value="+39">+39</option><option value="+1">+1</option><option value="+44">+44</option><option value="+33">+33</option>
                  <option value="+49">+49</option><option value="+34">+34</option><option value="+41">+41</option><option value="+86">+86</option><option value="+81">+81</option>
                </select>
                <input type="tel" className={`flex-1 ${selectClass} placeholder:text-gray-400 placeholder:italic`} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} placeholder="123 4567890" />
              </div>
              {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
              {phoneValidation === 'checking' && <p className="text-gray-400 text-sm mt-1.5 flex items-center gap-1.5"><Spinner /> Checking...</p>}
              {phoneValidation === 'valid' && phone && <p className="text-green-600 text-sm mt-1.5 flex items-center gap-1"><Check /> Available</p>}
              {phoneValidation === 'invalid' && (
                <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-amber-800">Already exists</p>
                    {existingPhoneCustomer && <p className="text-xs text-amber-600 truncate">{existingPhoneCustomer.firstName} {existingPhoneCustomer.lastName}</p>}
                  </div>
                  {existingPhoneCustomer?.email && (
                    <Button type="button" onClick={() => navigate(`/customers/${encodeURIComponent(existingPhoneCustomer.email!)}`)} className="shrink-0 text-xs px-3 py-1.5">Open</Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Step 2 */}
        <div id="section-info" className="scroll-mt-32" />
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-black text-white text-xs font-bold">2</span>
            <h2 className="text-lg font-semibold text-gray-900">Customer Information</h2>
          </div>
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
                <option value="Italy">Italy</option><option value="France">France</option><option value="Germany">Germany</option>
                <option value="Spain">Spain</option><option value="Switzerland">Switzerland</option><option value="United Kingdom">United Kingdom</option>
                <option value="United States">United States</option><option value="China">China</option><option value="Japan">Japan</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Step 3 */}
        <div id="section-children" className="scroll-mt-32" />
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 text-gray-500 text-xs font-bold">3</span>
            <h2 className="text-lg font-semibold text-gray-900">Children <span className="text-gray-400 font-normal text-sm">(Optional)</span></h2>
          </div>
          <div className="space-y-4">
            {children.map((child, index) => (
              <div key={index} className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between"><h4 className="font-medium text-gray-900 text-sm">Child {index + 1}</h4><button type="button" onClick={() => removeChild(index)} className="text-xs text-red-500 hover:text-red-700 transition-colors cursor-pointer">Remove</button></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Input label="Name" value={child.name || ''} onChange={(e) => updateChild(index, 'name', e.target.value)} />
                  <Input label="Birth Date" type="date" value={child.birthDate || ''} onChange={(e) => updateChild(index, 'birthDate', e.target.value)} error={errors[`child-${index}-birthDate`]} />
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1.5">Gender</label>
                    <div className="flex gap-2">
                      {([
                        { value: 'male', label: 'Boy', icon: '\u2642', activeBg: 'bg-blue-50', activeBorder: 'border-blue-300', activeText: 'text-blue-700' },
                        { value: 'female', label: 'Girl', icon: '\u2640', activeBg: 'bg-pink-50', activeBorder: 'border-pink-300', activeText: 'text-pink-700' },
                      ] as const).map((option) => {
                        const isActive = child.gender === option.value;
                        return (
                          <button key={option.value} type="button" onClick={() => updateChild(index, 'gender', isActive ? '' : option.value)}
                            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border transition-all text-sm font-medium ${isActive ? `${option.activeBg} ${option.activeBorder} ${option.activeText}` : 'border-gray-300 bg-white hover:border-gray-400 text-gray-500'}`}>
                            <span>{option.icon}</span>{option.label}
                          </button>
                        );
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

        {/* Step 4 */}
        <div id="section-consents" className="scroll-mt-32" />
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-black text-white text-xs font-bold">4</span>
            <h2 className="text-lg font-semibold text-gray-900">Consents</h2>
          </div>
          <div className="space-y-4">
            <Toggle label="Loyalty Program Enrollment" description="Customer enrolls in the Monnalisa Loyalty Program" checked={loyaltyEnrollment} onChange={setLoyaltyEnrollment} />
            <Toggle label="Marketing Consent" description="Customer agrees to receive marketing communications" checked={marketingConsent} onChange={setMarketingConsent} />
            <Toggle label="Privacy Policy Consent" description="Implicit consent via double opt-in email." checked={true} onChange={() => {}} disabled />
          </div>
        </Card>

        {/* Store */}
        <Card>
          <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Store</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-gray-400 text-xs">Store</p><p className="text-gray-900 font-medium">{session?.storeName}</p></div>
            <div><p className="text-gray-400 text-xs">Location</p><p className="text-gray-900 font-medium">{session?.storeAddress}</p></div>
            <div><p className="text-gray-400 text-xs">Store ID</p><p className="text-gray-900 font-medium">{session?.storeId}</p></div>
            <div><p className="text-gray-400 text-xs">Sales Associate</p><p className="text-gray-900 font-medium">{session?.salesAssociateId}</p></div>
          </div>
        </Card>

        {submitError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-sm font-medium text-red-700">{submitError}</p>
            {submitErrorCustomer?.email && (
              <div className="mt-3 flex items-center justify-between gap-4 pt-3 border-t border-red-200">
                <p className="text-sm text-red-600 truncate">{submitErrorCustomer.firstName} {submitErrorCustomer.lastName}</p>
                <Button type="button" onClick={() => navigate(`/customers/${encodeURIComponent(submitErrorCustomer.email!)}`)} className="shrink-0 text-xs px-3 py-1.5">Open Profile</Button>
              </div>
            )}
          </div>
        )}
        {submitSuccess && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm font-medium">Customer registered successfully!</div>}
      </form>

      <div className="mt-8 bg-white border border-gray-200 rounded-2xl p-6 text-center">
        {submitSuccess ? (
          <div>
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3"><Check /></div>
            <p className="text-lg font-semibold text-gray-900 mb-1">Customer registered!</p>
            <p className="text-sm text-gray-400">Redirecting to profile...</p>
          </div>
        ) : submitError ? (
          <div>
            <p className="text-sm text-red-600 mb-3">{submitError}</p>
            <Button type="submit" form="register-form" isLoading={isSubmitting} className="px-8">Try Again</Button>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-400 mb-3">Ready to register this customer?</p>
            <div className="flex items-center justify-center gap-3">
              <Button type="submit" form="register-form" isLoading={isSubmitting} className="px-8">Register Customer</Button>
              <Button type="button" variant="outline" onClick={resetForm} disabled={isSubmitting}>Clear Form</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
