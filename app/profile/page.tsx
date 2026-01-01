'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function ProfilePage() {
  const { data: session, update } = useSession();
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [profilePictureUrl, setProfilePictureUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (session?.user) {
      setName(session.user.name || '');
      setEmail(session.user.email || '');
      setProfilePictureUrl(session.user.image || '');
    }
  }, [session]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          profilePicture: profilePictureUrl,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage('Profile updated successfully!');
        // Update session
        await update();
      } else {
        setMessage(data.error || 'Failed to update profile');
      }
    } catch (error) {
      setMessage('An error occurred while updating your profile');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h2 className="text-3xl font-bold text-slate-100 mb-6">Profile Settings</h2>

      <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 p-6">
        {message && (
          <div
            className={`mb-4 px-4 py-3 rounded-lg ${
              message.includes('success')
                ? 'bg-green-900/30 border border-green-600 text-green-200'
                : 'bg-red-900/30 border border-red-600 text-red-200'
            }`}
          >
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Profile Picture */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-32 h-32 rounded-full overflow-hidden bg-slate-700 border-4 border-slate-600 mb-4">
              {profilePictureUrl ? (
                <img
                  src={profilePictureUrl}
                  alt="Profile"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                  }}
                />
              ) : null}
              <div className={`w-full h-full flex items-center justify-center text-4xl font-bold text-white ${profilePictureUrl ? 'hidden' : ''}`}>
                {name?.charAt(0)?.toUpperCase() || session?.user?.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
            </div>
            <div className="w-full">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Profile Picture URL
              </label>
              <input
                type="url"
                value={profilePictureUrl}
                onChange={(e) => setProfilePictureUrl(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-4 py-2 focus:border-blue-500 focus:outline-none"
                placeholder="https://example.com/your-photo.jpg"
              />
              <p className="text-xs text-slate-400 mt-1">
                Enter a URL to an image to use as your profile picture
              </p>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-4 py-2 focus:border-blue-500 focus:outline-none"
              required
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-4 py-2 focus:border-blue-500 focus:outline-none"
              required
            />
          </div>

          {/* Username (read-only) */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Username
            </label>
            <input
              type="text"
              value={session?.user?.email?.split('@')[0] || ''}
              className="w-full bg-slate-700/50 border border-slate-600 text-slate-400 rounded-lg px-4 py-2 cursor-not-allowed"
              disabled
            />
            <p className="text-xs text-slate-400 mt-1">Username cannot be changed</p>
          </div>

          {/* Buttons */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-2 border border-slate-600 text-slate-300 rounded-lg font-medium hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
