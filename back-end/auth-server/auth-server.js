const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const app = express();
require('dotenv').config();
const jwt = require('jsonwebtoken');
const pool = require('./db');
const bcrypt = require('bcrypt'); 

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

app.post('/register', async (req, res) => {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
        return res.status(400).json({ message: 'All fields are required' });
    }
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.execute(
            'INSERT INTO users (username, password, email) VALUES (?, ? , ?)', 
            [username, hashedPassword, email]
        );
        res.status(201).send('User registered safely!');
    } catch (error) {
        console.error(error);
        // Handle duplicate entry error code from MySQL (1062)
        if (error.errno === 1062) {
            return res.status(400).json({ message: 'Username or Email already exists' });
        }
        res.sendStatus(500);
    }
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body; 

    try {
        const [users] = await pool.execute('SELECT * FROM users WHERE username = ? LIMIT 1', [username]);
        
        if (users.length === 0) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }

        const user = users[0];
        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
            return res.status(401).json({ message: 'Invalid username or password' }); 
        }
        
        const userPayload = { name: username, user_id: user.id };
        const accessToken = generateAccessToken(userPayload);
        const refreshToken = jwt.sign(userPayload, process.env.REFRESH_TOKEN_SECRET);
        
        await pool.execute('UPDATE users SET refreshToken = ? WHERE username = ?', [refreshToken, username]);

        res.cookie('accessToken', accessToken, {
          httpOnly: true,
          secure: false,
          sameSite: 'strict', 
          path: '/',
          maxAge: 60 * 1000, // 1 minutes
        });

        res.cookie('refreshToken', refreshToken, {
          httpOnly: true,
          secure: false,
          sameSite: 'strict',
          path : '/',
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        res.json({ message: 'Logged in successfully' });
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

app.get('/token', async (req, res) => {
    const refreshToken = req.cookies?.refreshToken || req.body?.token || null;
    if (refreshToken == null) return res.sendStatus(401);

    try {
        const tokenExists = await checkIfValueExists("users", "refreshToken", refreshToken);
        if (!tokenExists) return res.sendStatus(403);
        // Verify the token using the synchronous method wrapped safely in the try block
        const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        // Strip out old metadata (like iat, exp) and only pass the necessary payload info
        const accessToken = generateAccessToken({ name: decoded.name, user_id: decoded.user_id ?? decoded.id });
        res.cookie('accessToken', accessToken, {
          httpOnly: true,
          secure: false,
          sameSite: 'strict',
          path : '/',
          maxAge: 60 * 1000, // 7 days minute for testing
        });
        res.status(200).json({ username: decoded.name, user_id: decoded.user_id ?? decoded.id, userId: decoded.user_id ?? decoded.id })
    } catch (error) {
        console.error('Token verification failed:', error);
        return res.sendStatus(403); // Treat invalid/expired signatures as Forbidden
    }
});

app.delete('/logout', async (req, res) => {
    const refreshToken = req.cookies?.refreshToken || null;
    try {
        const query = `UPDATE users SET refreshToken = NULL WHERE refreshToken = ?`;
        const [result] = await pool.execute(query, [refreshToken]);
        
        if (result.affectedRows > 0) {
            console.log(`Successfully deleted refresh token`);
        } else {
            console.log(`No refresh token found.`);
        }

        res.clearCookie('accessToken', {
          httpOnly: true,
          secure: false,
          sameSite: 'strict',
          path: '/',
        });
        res.clearCookie('refreshToken', {
          httpOnly: true,
          secure: false,
          sameSite: 'strict',
          path: '/',
        });

        res.sendStatus(204);
    } catch (error) {
        console.error('Error updating column to NULL:', error);
        res.sendStatus(500);
    }
});


function generateAccessToken(user) {
    return jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '10m' });
}

async function checkIfValueExists(tableName, columnName, value) {
    try {
        const query = `SELECT 1 FROM \`${tableName}\` WHERE \`${columnName}\` = ? LIMIT 1`;
        const [rows] = await pool.execute(query, [value]);
        return rows.length > 0;
    } catch (error) {
        console.error('Error checking value existence:', error);
        throw error;
    }
}

app.listen(2000, () => console.log('Auth server running on port 2000'));