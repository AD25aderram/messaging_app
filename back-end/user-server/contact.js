const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const app = express();
require('dotenv').config();
const jwt = require('jsonwebtoken');
// Allow browser origins used during development (vite:5173, nginx gateway:8080)
const allowedOrigins = ['http://localhost:5173', 'http://localhost:8080'];
app.use(cors({
    origin: function (origin, cb) {
        // allow requests with no origin (server-to-server, curl)
        if (!origin) return cb(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) return cb(null, true);
        return cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

const posts = [
  {
    username: 'adam',
    post: 'p1',
  },
  {
    username: 'amine',
    post: 'p2',
  },
];

app.get('/', authenticateToken , async (req, res) => {
    const userId = req.user?.user_id ?? req.user?.userId ?? req.user?.id;

    if (!userId) {
        return res.status(401).json({ error: 'Missing authenticated user id' });
    }

    try {
        const resp = await fetch('http://localhost:8080/contacts-id/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                user_id: userId
            })
        });

        if (!resp.ok) {
            return res.sendStatus(resp.status);
        }

        const contacts = await resp.json();
        return res.json(contacts);
    } catch (err) {
        console.error('error fetching contacts', err);
        return res.sendStatus(502);
    }
})

// Search a user by username across the full user database
// Frontend: GET /contact/search?username=someuser
app.get('/search', authenticateToken, async (req, res) => {
    const username = req.query?.username;
    if (!username) {
        return res.status(400).json({ error: 'username query parameter is required' });
    }

    try {
        const pool = require('./db');
        const [rows] = await pool.execute(
            'SELECT  id, username, email FROM users WHERE username = ? LIMIT 1',
            [username]
        );

        if (!rows || rows.length === 0) {
            return res.status(404).json({ found: false });
        }

        const user = rows[0];
        return res.json({ id: user.id, username: user.username, email: user.email });
    } catch (err) {
        console.error('contact search failed', err);
        return res.status(500).json({ error: 'Unable to search user' });
    }
})

// Create and send an invite email for a friend (server-side token signing)
// Frontend: POST /contact/invite { friendId }
app.post('/invite', authenticateToken, async (req, res) => {
    const inviterId = req.user?.user_id;
    const friendId = req.body?.friendId;

    if (!inviterId) return res.status(401).json({ error: 'Missing inviter id' });
    if (!friendId) return res.status(400).json({ error: 'friendId is required' });

    try {
        const pool = require('./db');
        // Lookup friend's email
        const [rows] = await pool.execute('SELECT id, username, email FROM users WHERE id = ? LIMIT 1', [friendId]);
        if (!rows || rows.length === 0) {
            return res.status(404).json({ error: 'Friend not found' });
        }

        const friend = rows[0];

        // Sign token server-side using FRIEND_TOKEN_SECRET
        const jwt = require('jsonwebtoken');
        const secret = process.env.FRIEND_TOKEN_SECRET;
        if (!secret) {
            console.error('Missing FRIEND_TOKEN_SECRET in env')
            return res.status(500).json({ error: 'Server not configured for token signing' });
        }

        const payload = { u: inviterId, f: friend.id };
        const token = jwt.sign(payload, secret, { expiresIn: '7d' });
        const inviteLink = `http://localhost:8080/email-service/${token}`;

        // Call email service
        const inviteBody = {
            toEmail: friend.email,
            inviteLink,
            inviterName: req.user?.name || 'Inviter',
        };

        // Send invite via nginx gateway only (do not fallback to direct upstream)
        const nginxUrl = 'http://localhost:8080/java-service/api/invite';

        console.log('sending invite via nginx:', nginxUrl, 'inviteBody:', inviteBody);
        const resp = await fetch(nginxUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(inviteBody),
        });

        if (!resp.ok) {
            const txt = await resp.text();
            console.error('email service (nginx) returned error', resp.status, txt);
            return res.status(502).json({ error: 'Email service error', detail: txt });
        }

        const result = await resp.json();
        return res.json({ sent: true, result, via: 'nginx' });
    } catch (err) {
        console.error('invite send failed', err);
        return res.status(500).json({ error: 'Unable to send invite' });
    }
})


async function authenticateToken(req, res, next) {
    const token = req.cookies?.accessToken;
    if (token != null) {
        try {
            const user = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
            req.user = user;
            return next();
        } catch (err) {
            console.error('invalid accestoken', err);
        }
    }

    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) return res.sendStatus(403);

    try {
        const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        const userPayload = {
            name: decoded.name,
            user_id: decoded.user_id ?? decoded.userId ?? decoded.id,
        };

        const newAccessToken = jwt.sign(userPayload, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '10m' });
        res.cookie('accessToken', newAccessToken, {
            httpOnly: true,
            secure: false,
            sameSite: 'strict',
            path: '/',
            maxAge: 60 * 1000,
        });

        req.user = userPayload;
        return next();
    } catch (err) {
        console.error('invalid refresh token', err);
        return res.sendStatus(401);
    }
}

app.listen(2222);