'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function ProfilePage() {
  const { data: session, update } = useSession();
  const router = useRouter();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [profilePictureUrl, setProfilePictureUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchUserData = async () => {
      if (session?.user) {
        try {
          const response = await fetch('/api/user/profile');
          const data = await response.json();

          if (data.success) {
            setFirstName(data.user.firstName || '');
            setLastName(data.user.lastName || '');
            setEmail(data.user.email || '');
            setUsername(data.user.username || '');
            setProfilePictureUrl(data.user.profilePicture || '');
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        } finally {
          setIsFetching(false);
        }
      }
    };

    fetchUserData();
  }, [session]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setMessage('Image must be less than 2MB');
      return;
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      setMessage('Please upload an image file');
      return;
    }

    setIsUploading(true);
    setMessage('');

    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setProfilePictureUrl(base64String);
        setIsUploading(false);
        setMessage('Image uploaded! Click Save Changes to update your profile.');
      };
      reader.onerror = () => {
        setMessage('Failed to read image file');
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      setMessage('Failed to upload image');
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
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
    <div className="bb-page max-w-4xl">
      <h2 className="text-3xl font-semibold text-ink mb-6">Profile Settings</h2>

      <div className="bb-panel p-6">
        {message && (
          <div
            className={`mb-4 px-4 py-3  ${
              message.includes('success')
                ? 'bg-success/10 border border-success/30 text-success'
                : 'bg-error/10 border border-error/30 text-error'
            }`}
          >
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Profile Picture */}
          <div className="grid gap-6 border-b border-rule pb-6 mb-6 sm:grid-cols-[96px_minmax(0,1fr)]">
            <div className="w-24 h-24 overflow-hidden bg-paper-3 border border-rule mb-4">
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
              <div className={`w-full h-full flex items-center justify-center text-4xl font-medium text-ink ${profilePictureUrl ? 'hidden' : ''}`}>
                {firstName?.charAt(0)?.toUpperCase() || '?'}
              </div>
            </div>
            <div className="w-full space-y-4">
              {/* Upload from Computer */}
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-2">
                  Upload Profile Picture
                </label>
                <div className="flex items-center gap-3">
                  <label
                    htmlFor="file-upload"
                    className="bb-button px-4 py-2 bg-accent hover:bg-accent text-accent-ink font-medium cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUploading ? 'Uploading...' : 'Choose File'}
                  </label>
                  <input
                    id="file-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={isUploading}
                  />
                  <span className="text-xs text-muted">Max 2MB</span>
                </div>
              </div>

              {/* OR Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-rule"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 bg-paper-2 text-muted">OR</span>
                </div>
              </div>

              {/* URL Input */}
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-2">
                  Profile Picture URL
                </label>
                <input
                  type="url"
                  value={profilePictureUrl?.startsWith('data:') ? '' : profilePictureUrl}
                  onChange={(e) => setProfilePictureUrl(e.target.value)}
                  className="bb-field w-full bg-paper-3 border border-rule text-ink px-4 py-2 focus:border-rule focus:outline-none"
                  placeholder="https://example.com/your-photo.jpg"
                />
                <p className="text-xs text-muted mt-1">
                  Or enter a URL to an image
                </p>
              </div>
            </div>
          </div>

          {/* Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink-2 mb-2">
                First Name
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="bb-field w-full bg-paper-3 border border-rule text-ink px-4 py-2 focus:border-rule focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-2 mb-2">
                Last Name <span className="text-muted">(optional)</span>
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="bb-field w-full bg-paper-3 border border-rule text-ink px-4 py-2 focus:border-rule focus:outline-none"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bb-field w-full bg-paper-3 border border-rule text-ink px-4 py-2 focus:border-rule focus:outline-none"
              required
            />
          </div>

          {/* Username (read-only) */}
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-2">
              Username
            </label>
            <input
              type="text"
              value={username}
              className="bb-field w-full bg-paper-3 border border-rule text-muted px-4 py-2 cursor-not-allowed"
              disabled
            />
            <p className="text-xs text-muted mt-1">Username cannot be changed</p>
          </div>

          {/* Buttons */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-2 border border-rule text-ink-2 font-medium hover:bg-paper-3 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="bb-button px-6 py-2 bg-accent text-accent-ink font-medium hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
