import { useState, FormEvent, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Toggle } from '../components/Toggle';
import type { Child } from '../lib/types';

type ValidationStatus = 'idle' | 'checking' | 'valid' | 'invalid';

interface ExistingCustomerInfo {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
}

export function CustomerNew() {
  const { session } = useAuth();
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
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [preferences, setPreferences] = useState({
    gender: [] as string[],
    style: [] as string[],
    ageRange: [] as string[],
    notes: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Email validation state
  const [emailValidation, setEmailValidation] = useState<ValidationStatus>('idle');
  const [emailMessage, setEmailMessage] = useState('');
  const [existingEmailCustomer, setExistingEmailCustomer] = useState<ExistingCustomerInfo | null>(null);
  const emailTimeoutRef = useRef<NodeJS.Timeout>();

  // Phone validation state
  const [phoneValidation, setPhoneValidation] = useState<ValidationStatus>('idle');
  const [phoneMessage, setPhoneMessage] = useState('');
  const [existingPhoneCustomer, setExistingPhoneCustomer] = useState<ExistingCustomerInfo | null>(null);
  const phoneTimeoutRef = useRef<NodeJS.Timeout>();

  // Email validation effect
  useEffect(() => {
    if (emailTimeoutRef.current) {
      clearTimeout(emailTimeoutRef.current);
    }

    if (!email || !email.trim()) {
      setEmailValidation('idle');
      setEmailMessage('');
      setExistingEmailCustomer(null);
      return;
    }

    // Basic email format validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailValidation('idle');
      setEmailMessage('');
      setExistingEmailCustomer(null);
      return;
    }

    setEmailValidation('checking');
    setEmailMessage('');

    emailTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/customers/check-email?email=${encodeURIComponent(email)}`);
        const data = await response.json();

        if (data.available) {
          setEmailValidation('valid');
          setEmailMessage('');
          setExistingEmailCustomer(null);
        } else {
          setEmailValidation('invalid');
          setEmailMessage(data.suggestion || data.message);
          setExistingEmailCustomer(data.customer || null);
        }
      } catch (error) {
        console.error('Email validation error:', error);
        setEmailValidation('idle');
      }
    }, 500);
  }, [email]);

  // Phone validation effect
  useEffect(() => {
    if (phoneTimeoutRef.current) {
      clearTimeout(phoneTimeoutRef.current);
    }

    if (!phone || !phone.trim()) {
      setPhoneValidation('idle');
      setPhoneMessage('');
      setExistingPhoneCustomer(null);
      return;
    }

    setPhoneValidation('checking');
    setPhoneMessage('');

    phoneTimeoutRef.current = setTimeout(async () => {
      try {
        const fullPhone = `${phoneCountry} ${phone}`;
        const response = await fetch(`/api/customers/check-phone?phone=${encodeURIComponent(fullPhone)}`);
        const data = await response.json();

        if (data.available) {
          setPhoneValidation('valid');
          setPhoneMessage('');
          setExistingPhoneCustomer(null);
        } else {
          setPhoneValidation('invalid');
          setPhoneMessage(data.suggestion || data.message);
          setExistingPhoneCustomer(data.customer || null);
        }
      } catch (error) {
        console.error('Phone validation error:', error);
        setPhoneValidation('idle');
      }
    }, 500);
  }, [phone, phoneCountry]);

  const addChild = () => {
    setChildren([...children, { name: '', birthDate: '', gender: undefined }]);
  };

  const removeChild = (index: number) => {
    setChildren(children.filter((_, i) => i !== index));
  };

  const updateChild = (index: number, field: keyof Child, value: string) => {
    const updated = [...children];
    updated[index] = { ...updated[index], [field]: value || undefined };
    setChildren(updated);
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

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!firstName.trim()) newErrors.firstName = 'First name is required';
    if (!lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Invalid email format';
    } else if (emailValidation === 'invalid') {
      newErrors.email = 'This email is already registered';
    }

    if (phone && phoneValidation === 'invalid') {
      newErrors.phone = 'This phone number is already registered';
    }

    if (!loyaltyEnrollment) {
      newErrors.loyaltyEnrollment = 'Customer must enroll in loyalty program';
    }

    if (!privacyConsent) {
      newErrors.privacyConsent = 'Privacy policy consent is required';
    }

    if (dateOfBirth && new Date(dateOfBirth) > new Date()) {
      newErrors.dateOfBirth = 'Birth date cannot be in the future';
    }

    children.forEach((child, index) => {
      if (child.birthDate && new Date(child.birthDate) > new Date()) {
        newErrors[`child-${index}-birthDate`] = 'Birth date cannot be in the future';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    setSubmitSuccess(false);

    if (!validate()) return;

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          phone: phone ? `${phoneCountry} ${phone}` : undefined,
          dateOfBirth: dateOfBirth || undefined,
          address: address || undefined,
          city: city || undefined,
          postalCode: postalCode || undefined,
          country: country || undefined,
          children: children.length > 0 ? children : undefined,
          loyaltyEnrollment,
          marketingConsent,
          privacyConsent,
          preferences: {
            gender: preferences.gender,
            style: preferences.style,
            ageRange: preferences.ageRange,
            notes: preferences.notes || undefined,
          },
          storeId: session?.storeId,
          salesAssociateId: session?.salesAssociateId,
        }),
      });

      if (response.status === 409) {
        setSubmitError('A customer with this email already exists');
        setIsSubmitting(false);
        return;
      }

      if (!response.ok) {
        throw new Error('Registration failed');
      }

      setSubmitSuccess(true);
      // Reset form after short delay
      setTimeout(() => {
        resetForm();
        setSubmitSuccess(false);
      }, 2000);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Registration failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhoneCountry('+39');
    setPhone('');
    setDateOfBirth('');
    setAddress('');
    setCity('');
    setPostalCode('');
    setCountry('Italy');
    setChildren([]);
    setLoyaltyEnrollment(true);
    setMarketingConsent(false);
    setPrivacyConsent(false);
    setPreferences({
      gender: [],
      style: [],
      ageRange: [],
      notes: '',
    });
    setErrors({});
    setEmailValidation('idle');
    setEmailMessage('');
    setExistingEmailCustomer(null);
    setPhoneValidation('idle');
    setPhoneMessage('');
    setExistingPhoneCustomer(null);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Register New Customer</h1>
        <Button variant="outline" onClick={() => navigate('/')}>
          Back to Dashboard
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Verify Customer Identity */}
        <Card title="Step 1: Verify Customer Identity">
          <p className="text-sm text-gray-600 mb-4">
            Check if the customer already exists by verifying their email and phone number first.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={errors.email}
                required
              />
              {emailValidation === 'checking' && (
                <p className="text-blue-600 text-sm mt-1 flex items-center gap-1">
                  <span className="animate-spin">⟳</span> Checking availability...
                </p>
              )}
              {emailValidation === 'valid' && email && (
                <p className="text-green-600 text-sm mt-1 flex items-center gap-1">
                  ✓ Email available
                </p>
              )}
              {emailValidation === 'invalid' && existingEmailCustomer && (
                <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
                  <p className="text-amber-800 text-sm font-medium mb-2">{emailMessage}</p>
                  <button
                    type="button"
                    onClick={() => navigate(`/customer/${existingEmailCustomer.id}`)}
                    className="text-sm text-blue-600 hover:text-blue-800 underline"
                  >
                    View existing customer: {existingEmailCustomer.firstName} {existingEmailCustomer.lastName}
                  </button>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <div className="flex gap-2">
                <select
                  className="w-28 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={phoneCountry}
                  onChange={(e) => setPhoneCountry(e.target.value)}
                >
                  <option value="+39">🇮🇹 +39</option>
                  <option value="+1">🇺🇸 +1</option>
                  <option value="+44">🇬🇧 +44</option>
                  <option value="+33">🇫🇷 +33</option>
                  <option value="+49">🇩🇪 +49</option>
                  <option value="+34">🇪🇸 +34</option>
                  <option value="+41">🇨🇭 +41</option>
                  <option value="+86">🇨🇳 +86</option>
                  <option value="+81">🇯🇵 +81</option>
                </select>
                <input
                  type="tel"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={phone}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    setPhone(value);
                  }}
                  placeholder="123 4567890"
                />
              </div>
              {errors.phone && (
                <p className="text-red-500 text-sm mt-1">{errors.phone}</p>
              )}
              {phoneValidation === 'checking' && (
                <p className="text-blue-600 text-sm mt-1 flex items-center gap-1">
                  <span className="animate-spin">⟳</span> Checking availability...
                </p>
              )}
              {phoneValidation === 'valid' && phone && (
                <p className="text-green-600 text-sm mt-1 flex items-center gap-1">
                  ✓ Phone available
                </p>
              )}
              {phoneValidation === 'invalid' && existingPhoneCustomer && (
                <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
                  <p className="text-amber-800 text-sm font-medium mb-2">{phoneMessage}</p>
                  <button
                    type="button"
                    onClick={() => navigate(`/customer/${existingPhoneCustomer.id}`)}
                    className="text-sm text-blue-600 hover:text-blue-800 underline"
                  >
                    View existing customer: {existingPhoneCustomer.firstName} {existingPhoneCustomer.lastName}
                  </button>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Step 2: Customer Information */}
        <Card title="Step 2: Customer Information">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              error={errors.firstName}
              required
            />
            <Input
              label="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              error={errors.lastName}
              required
            />
            <Input
              label="Date of Birth"
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              error={errors.dateOfBirth}
            />
          </div>

          <div className="mt-4">
            <Input
              label="Address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street address"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <Input
              label="City"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
            <Input
              label="Postal Code"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Country
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              >
                <option value="Italy">Italy</option>
                <option value="France">France</option>
                <option value="Germany">Germany</option>
                <option value="Spain">Spain</option>
                <option value="Switzerland">Switzerland</option>
                <option value="United Kingdom">United Kingdom</option>
                <option value="United States">United States</option>
                <option value="China">China</option>
                <option value="Japan">Japan</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Step 3: Children */}
        <Card title="Step 3: Children (Optional)">
          <div className="space-y-4">
            {children.map((child, index) => (
              <div key={index} className="p-4 border border-gray-200 rounded-lg space-y-3">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900">Child {index + 1}</h4>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => removeChild(index)}
                    className="text-sm py-1 px-3 text-red-600"
                  >
                    Remove
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Input
                    label="Name"
                    value={child.name || ''}
                    onChange={(e) => updateChild(index, 'name', e.target.value)}
                  />
                  <Input
                    label="Birth Date"
                    type="date"
                    value={child.birthDate || ''}
                    onChange={(e) => updateChild(index, 'birthDate', e.target.value)}
                    error={errors[`child-${index}-birthDate`]}
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Gender
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={child.gender || ''}
                      onChange={(e) => updateChild(index, 'gender', e.target.value)}
                    >
                      <option value="">Select...</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}

            <Button type="button" variant="outline" onClick={addChild} className="w-full">
              + Add Child
            </Button>
          </div>
        </Card>

        {/* Step 4: Preferences */}
        <Card title="Step 4: Preferences">
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

        {/* Step 5: Consents */}
        <Card title="Step 5: Consents">
          <div className="space-y-4">
            <Toggle
              label="Loyalty Program Enrollment"
              description="Customer enrolls in the Monnalisa Loyalty Program"
              checked={loyaltyEnrollment}
              onChange={setLoyaltyEnrollment}
              required
            />
            {errors.loyaltyEnrollment && (
              <p className="text-red-500 text-sm">{errors.loyaltyEnrollment}</p>
            )}

            <Toggle
              label="Marketing Consent"
              description="Customer agrees to receive marketing communications"
              checked={marketingConsent}
              onChange={setMarketingConsent}
            />

            <Toggle
              label="Privacy Policy Consent"
              description="Customer agrees to the privacy policy terms"
              checked={privacyConsent}
              onChange={setPrivacyConsent}
              required
            />
            {errors.privacyConsent && (
              <p className="text-red-500 text-sm">{errors.privacyConsent}</p>
            )}
          </div>
        </Card>

        {/* Store Context */}
        <Card title="Store Information (Read-only)">
          <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
            <p>
              <span className="font-medium">Store:</span> {session?.storeName}
            </p>
            <p>
              <span className="font-medium">Location:</span> {session?.storeAddress}
            </p>
            <p>
              <span className="font-medium">Store ID:</span> {session?.storeId}
            </p>
            <p>
              <span className="font-medium">Sales Associate:</span> {session?.salesAssociateId}
            </p>
          </div>
        </Card>

        {/* Submit */}
        {submitError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {submitError}
          </div>
        )}

        {submitSuccess && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
            Customer registered successfully!
          </div>
        )}

        <div className="flex gap-4">
          <Button type="submit" className="flex-1" isLoading={isSubmitting}>
            Register Customer
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={resetForm}
            disabled={isSubmitting}
          >
            Clear Form
          </Button>
        </div>
      </form>
    </div>
  );
}
