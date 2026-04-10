require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const admin = require('firebase-admin');
const { BetaAnalyticsDataClient } = require('@google-analytics/data');

const app = express();
const port = process.env.PORT || 3000;

// Initialize Firebase Admin (Uses GOOGLE_APPLICATION_CREDENTIALS)
admin.initializeApp({
    credential: admin.credential.applicationDefault()
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // set to true if using https 
        maxAge: 24 * 60 * 60 * 1000 // 1 day
    }
}));

app.post('/api/login', async (req, res) => {
    const { idToken } = req.body;
    
    if (!idToken) {
        return res.status(401).json({ error: 'No token provided' });
    }
    
    try {
        // Verify token with Firebase
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const email = decodedToken.email;
        
        // Ensure email matches the predefined admin email
        if (email === process.env.ADMIN_EMAIL) {
            req.session.authenticated = true;
            res.json({ success: true });
        } else {
            console.warn(`Unauthorized login attempt by: ${email}`);
            res.status(403).json({ error: 'Unauthorized email address' });
        }
    } catch (error) {
        console.error('Firebase token verification error:', error.message);
        res.status(401).json({ error: 'Session verification failed' });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        res.json({ success: true });
    });
});

app.use((req, res, next) => {
    // Protect root, index.html, and the analytics API
    const authRequired = ['/', '/index.html', '/api/analytics'];
    if (authRequired.includes(req.path)) {
        if (req.session && req.session.authenticated) {
            return next();
        }
        if (req.path === '/api/analytics') {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        return res.redirect('/login.html');
    }
    next();
});

app.use(express.static('public'));

app.get('/api/analytics', async (req, res) => {
  try {
    const propertyId = process.env.GA_PROPERTY_ID;
    if (!propertyId || propertyId === 'YOUR_GA4_NUMERIC_PROPERTY_ID') {
        return res.status(500).json({ error: 'GA_PROPERTY_ID not configured in .env' });
    }

    const analyticsDataClient = new BetaAnalyticsDataClient();

    // Fetch summary data for the last 30 days grouped by page path and hostname
    const summaryPromise = analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
      dimensions: [{ name: 'hostName' }, { name: 'pagePath' }],
      metrics: [
        { name: 'screenPageViews' },
        { name: 'activeUsers' },
        { name: 'sessions' },
        { name: 'newUsers' },
        { name: 'engagementRate' },
        { name: 'averageSessionDuration' }
      ],
    });

    // Fetch timeseries data for the past 30 days to render global charts
    const timeseriesPromise = analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
      dimensions: [{ name: 'date' }],
      metrics: [
        { name: 'activeUsers' },
        { name: 'screenPageViews' }
      ],
    });

    const [[summaryResponse], [timeseriesResponse]] = await Promise.all([summaryPromise, timeseriesPromise]);

    const summaryResults = summaryResponse.rows.map(row => ({
        hostName: row.dimensionValues[0].value,
        pagePath: row.dimensionValues[1].value,
        views: parseInt(row.metricValues[0].value, 10) || 0,
        users: parseInt(row.metricValues[1].value, 10) || 0,
        sessions: parseInt(row.metricValues[2].value, 10) || 0,
        newUsers: parseInt(row.metricValues[3].value, 10) || 0,
        engagementRate: parseFloat(row.metricValues[4].value) || 0,
        avgDuration: parseFloat(row.metricValues[5].value) || 0
    }));

    const timeseriesResults = timeseriesResponse.rows.map(row => ({
        date: row.dimensionValues[0].value,
        users: parseInt(row.metricValues[0].value, 10) || 0,
        views: parseInt(row.metricValues[1].value, 10) || 0
    }));
    
    // Sort timeseries chronologically 
    timeseriesResults.sort((a, b) => a.date.localeCompare(b.date));
    
    res.json({ success: true, data: { summary: summaryResults, timeseries: timeseriesResults } });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics data', details: error.message });
  }
});

app.listen(port, () => {
  console.log(`VibeDashboard backend running at http://localhost:${port}`);
});
