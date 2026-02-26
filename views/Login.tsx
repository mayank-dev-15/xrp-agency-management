import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/db';
import { AuthContext } from '../AuthContext';
import { User } from '../types';
import { LogIn, Loader2 } from 'lucide-react';

const LoginView = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, user } = useContext(AuthContext);
  const navigate = useNavigate();

  // Redirect if already logged in
  React.useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  if (user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const foundUser = await api.auth.login(username, password);
      if (foundUser) {
        login(foundUser);
        navigate('/');
      } else {
        setError('نام کاربری یا رمز عبور اشتباه است.');
      }
    } catch (err) {
      setError('خطا در برقراری ارتباط با سرور.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-slate-900 p-4 transition-colors">
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-500">
        <div className="p-8 md:p-10">
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary-600 to-primary-400 flex items-center justify-center shadow-lg text-white font-extrabold text-3xl">
              X
            </div>
          </div>
          
          <h2 className="text-2xl font-black text-center text-gray-800 dark:text-white mb-2">ورود به XRM</h2>
          <p className="text-center text-gray-500 dark:text-gray-400 mb-8 text-sm">سیستم جامع مدیریت هوشمند</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">شماره تماس</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20 transition outline-none text-left dir-ltr"
                placeholder="0912..."
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">رمز عبور</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20 transition outline-none text-left dir-ltr"
                required
              />
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="remember" className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
              <label htmlFor="remember" className="text-sm text-gray-600 dark:text-gray-400 select-none">مرا به خاطر بسپار</label>
            </div>

            {error && (
              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 text-sm font-medium text-center animate-pulse">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-primary-500/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? <Loader2 className="animate-spin" /> : <LogIn size={20} />}
              <span>ورود به حساب کاربری</span>
            </button>
          </form>
        </div>
        <div className="bg-gray-50 dark:bg-slate-700/30 p-4 text-center text-xs text-gray-400">
          طراحی و توسعه برای عملکرد بدون نقص
        </div>
      </div>
    </div>
  );
};

export default LoginView;