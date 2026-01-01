# 🏒 Bench Boss - Fantasy Hockey Assistant

A professional fantasy hockey management application with enterprise-grade security and real-time NHL data integration.

## 🚀 Features

### Fantasy Hockey Tools
- **📊 Dashboard** - Overview of your team and weekly projections
- **🤖 AI Player Analysis** - Click any player to get AI-powered insights, outlook, and injury risk assessment
- **⚡ Lineup Optimizer** - Automatically set your best lineup
- **🤔 Start / Sit** - Compare players for optimal decisions
- **🔄 Trade Analyzer** - Evaluate trades with data-driven insights
- **🎯 Waiver Targets** - Discover hidden gems on the waiver wire
- **👥 Player Explorer** - Browse all NHL players with stats
- **⚙️ League Settings** - Customize scoring and roster settings

### Security Features
- **NextAuth.js** - Industry-standard authentication
- **JWT Tokens** - Stateless, encrypted sessions
- **bcrypt Hashing** - Secure password storage (10 salt rounds)
- **httpOnly Cookies** - XSS-proof token storage
- **CSRF Protection** - Built-in request forgery prevention
- **Session Management** - 7-day auto-refresh sessions

### NHL Data Integration
- **Live Roster Data** - All 32 NHL teams
- **Real-time Stats** - Current season statistics
- **Team Schedules** - Upcoming games and matchups
- **Projected Stats** - Weekly performance projections

## 🎯 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Modern web browser

### Installation

1. **Clone and install dependencies**
```bash
cd bench-boss
npm install
```

2. **Set up environment variables**
```bash
# Copy the example file
cp .env.example .env.local

# Generate a secure secret
openssl rand -base64 32

# Edit .env.local and add:
# NEXTAUTH_SECRET=<your-generated-secret>
# GROQ_API_KEY=<your-groq-api-key>
```

Get your **FREE** Groq API key from [https://console.groq.com/](https://console.groq.com/)

3. **Start the development server**
```bash
npm run dev
```

4. **Open your browser**
```
http://localhost:3000/welcome
```

## 🔐 Authentication

### Demo Account
- **Username**: `demo`
- **Password**: `demo1234`

### Create New Account
Sign up with any username and password (minimum 4 characters).

### How It Works
1. Visit `/welcome` landing page
2. Click "Get Started" or "Sign In"
3. Sign in with demo account or create new account
4. Session stored securely in httpOnly cookie
5. Access all protected routes (/dashboard, /players, etc.)
6. Session lasts 7 days with auto-refresh

## 📁 Project Structure

```
bench-boss/
├── app/                      # Next.js 15 App Router
│   ├── api/
│   │   ├── auth/            # NextAuth authentication
│   │   └── nhl-data/        # NHL API integration
│   ├── login/               # Login/signup page
│   ├── welcome/             # Landing page
│   ├── players/             # Player explorer
│   ├── startsit/            # Start/sit tool
│   ├── trades/              # Trade analyzer
│   ├── waivers/             # Waiver wire
│   ├── lineup/              # Lineup optimizer
│   ├── settings/            # League settings
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Dashboard
├── components/
│   ├── Layout.tsx           # Main app layout with sidebar
│   └── ProtectedRoute.tsx   # Route protection wrapper
├── lib/
│   ├── auth.ts              # NextAuth configuration
│   ├── AuthContext.tsx      # Session provider
│   ├── users.ts             # User management (bcrypt)
│   ├── nhlApi.ts            # NHL API client
│   ├── calculator.ts        # Fantasy points calculations
│   ├── DataContext.tsx      # NHL data provider
│   ├── liveData.ts          # Data fetching
│   └── mockdata.ts          # Demo data
├── .env.local               # Environment variables (gitignored)
├── .env.example             # Example env configuration
├── AUTHENTICATION.md        # Detailed auth documentation
├── SECURITY-IMPROVEMENTS.md # Security features summary
└── README.md                # This file
```

## 🛠️ Tech Stack

### Frontend
- **Next.js 15** - React framework with App Router
- **React 19** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling

### Backend
- **Next.js API Routes** - Serverless functions
- **NextAuth.js** - Authentication
- **bcryptjs** - Password hashing
- **Groq API** - FREE AI-powered player analysis (Llama 3.1 70B)

### Data
- **NHL API** - Real-time hockey data
- **Prisma + SQLite** - Database ORM and local storage
- **In-memory caching** - Fast data access

## 🤖 AI Player Analysis

### Features
Click on any player in your team roster to get:
- **AI-Powered Outlook** - Comprehensive analysis using Llama 3.1 70B
- **Fantasy Value Rating** - Must-Start, Start, Flex, Bench, or Drop
- **Trend Analysis** - Hot 🔥, Cold 🥶, or Steady ➡️
- **Strengths & Weaknesses** - Key performance indicators
- **Rest of Season Projection** - What to expect going forward
- **Injury Risk Assessment** - Low, Moderate, or High
- **Real-time Season Stats** - Games played, points, goals, assists, and more

### How It Works
1. Navigate to "My Team" page
2. Click on any player row
3. AI analyzes current stats, trends, and context
4. Get actionable insights in seconds

### API Usage
The AI analysis uses the **FREE** Groq API with the following model:
- **Model**: `llama-3.1-70b-versatile` (Meta's Llama 3.1 70B)
- **Max Tokens**: 1500 per request
- **Cost**: **$0.00** - Completely FREE! 🎉
- **Rate Limits**: 30 requests/minute (very generous)

## 📚 Documentation

- **[AUTHENTICATION.md](AUTHENTICATION.md)** - Complete authentication guide
  - Security architecture
  - JWT implementation
  - Production recommendations
  - Troubleshooting

- **[SECURITY-IMPROVEMENTS.md](SECURITY-IMPROVEMENTS.md)** - Security features
  - Before/after comparison
  - Implementation details
  - Testing checklist

## 🔒 Security

### Current Implementation (Demo)
- ✅ bcrypt password hashing
- ✅ httpOnly cookies
- ✅ JWT tokens with signing
- ✅ CSRF protection
- ✅ Session expiration
- ✅ Secure logout
- ⚠️ In-memory user storage (not persistent)

### Production Recommendations
1. **Database** - Add PostgreSQL/MySQL for user persistence
2. **Stronger Passwords** - Enforce complexity requirements
3. **Rate Limiting** - Prevent brute force attacks
4. **2FA** - Two-factor authentication
5. **OAuth** - Google/GitHub sign-in
6. **Email Verification** - Verify user emails
7. **Audit Logging** - Track authentication events

See [AUTHENTICATION.md](AUTHENTICATION.md) for implementation guides.

## 🧪 Testing

### Manual Testing
```bash
# Start dev server
npm run dev

# Test authentication
1. Visit http://localhost:3000/welcome
2. Click "Get Started"
3. Sign in with demo/demo1234
4. Verify redirect to dashboard
5. Check session persists on refresh
6. Sign out and verify redirect

# Test protected routes
1. Visit http://localhost:3000/players (not logged in)
2. Verify redirect to /welcome
3. Sign in
4. Verify access granted
```

### Security Checklist
- [x] Passwords hashed (check database/storage)
- [x] Sessions use httpOnly cookies
- [x] CSRF tokens present
- [x] Session expires after 7 days
- [x] Protected routes redirect when not authenticated
- [x] Sign out clears session completely

## 🐛 Troubleshooting

### "NEXTAUTH_SECRET missing"
Generate a secret: `openssl rand -base64 32` and add to `.env.local`

### "Users lost after restart"
Expected - using in-memory storage. Implement database for persistence.

### "Cannot access protected routes"
Sign in first at `/login`

### "Session expired"
Normal after 7 days. Sign in again.

### More help
See [AUTHENTICATION.md](AUTHENTICATION.md) troubleshooting section

## 📄 License

MIT License

## 👨‍💻 Built With

- NextAuth.js for production-ready authentication
- NHL API for real-time hockey data
- Next.js 15 with App Router

---

**Note**: This is a demo application. For production use, implement the recommendations in [AUTHENTICATION.md](AUTHENTICATION.md) and [SECURITY-IMPROVEMENTS.md](SECURITY-IMPROVEMENTS.md).
