import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Input } from '../components/Input';
import { Button } from '../components/Button';

export function Login() {
  const [email, setEmail] = useState('storemanager1@monnalisa.com');
  const [password, setPassword] = useState('zW~]@sD4feIAN#I#36y@');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = () => {
    setEmail('storemanager1@monnalisa.com');
    setPassword('zW~]@sD4feIAN#I#36y@');
    setTimeout(() => {
      document.getElementById('login-form')?.requestSubmit();
    }, 100);
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <img
            src="/logo-white.png"
            alt="Monnalisa"
            className="h-14 mx-auto mb-6 object-contain "
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.nextElementSibling?.classList.remove('hidden');
            }}
          />
          <h1 className="hidden text-3xl font-bold text-white mb-2">MONNALISA</h1>
          <p className="text-white/50 text-sm">Retail Loyalty Platform</p>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-2xl">
          <form id="login-form" onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button type="submit" className="flex-1" isLoading={isLoading}>
                Sign In
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleDemoLogin}
                disabled={isLoading}
              >
                Demo
              </Button>
            </div>
          </form>

          <div className="mt-6 pt-5 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center">
              Demo credentials pre-filled
              <br />
              <span className="font-mono text-[11px] text-gray-500">storemanager1@monnalisa.com</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
