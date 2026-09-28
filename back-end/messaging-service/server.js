const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

const dbPool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  waitForConnections: true,

});

app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'messaging-service' });
});

app.get('/history/:chatId', (req, res) => {
  const chatId = Number(req.params.chatId);
  const payload = JSON.stringify({ chat_id: chatId });

  const historyReq = http.request(
    {
      hostname: '127.0.0.1',
      port: 8080,
      path: '/messages/',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    },
    // rethink this it ( the server already return a list of jsons (wich is a json also so why this???))
    (historyRes) => {
      let data = '';
      historyRes.setEncoding('utf8');
      historyRes.on('data', (chunk) => {
        data += chunk;
      });
      historyRes.on('end', () => {
        res.status(historyRes.statusCode || 200);
        res.type('application/json').send(data);
      });
    }
  );

  historyReq.on('error', (error) => {
    console.error('history fetch failed', error);
    res.status(502).json({ error: 'Unable to reach legacy history service', detail: error.message });
  });

  historyReq.write(payload);
  historyReq.end();
});

app.put('/messages/:chatId/read', async (req, res) => {
  const chatId = Number(req.params.chatId);
  const userId = Number(req.body?.userId);

  if (!chatId || Number.isNaN(userId)) {
    return res.status(400).json({ error: 'chatId and userId are required' });
  }

  try {
    const [result] = await dbPool.execute(
      `UPDATE messages
       SET etat = 'lu'
       WHERE chat_id = ?
         AND source <> ?
         AND etat IN ('non_lu', 'nom_lu')`,
      [chatId, userId]
    );

    res.json({ updated: result.affectedRows });
  } catch (error) {
    console.error('Failed to mark chat read:', error);
    res.status(500).json({ error: 'Unable to mark messages as read' });
  }
});

const rooms = new Map();

io.on('connection', (socket) => {
  console.log('socket connected', socket.id);

  socket.on('join-room', ({ chatId, userId }) => {
    const roomName = `chat:${chatId}`;
    socket.join(roomName);

    if (!rooms.has(roomName)) {
      rooms.set(roomName, new Set());
    }
    const members = rooms.get(roomName);
    members.add(String(userId));

    socket.data = { roomName, userId, chatId };

    io.to(roomName).emit('room-joined', {
      roomName,
      userId,
      members: Array.from(members),
    });
  });

  socket.on('send-message', async ({ chatId, message, userId }) => {
    const chatIdNum = Number(chatId)
    const userIdNum = Number(userId)
    if (!chatIdNum || Number.isNaN(chatIdNum) || Number.isNaN(userIdNum)) {
      console.error('Invalid send-message payload', { chatId, userId })
      return
    }

    const roomName = `chat:${chatIdNum}`
    const clientMessageId = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    const payload = {
      id: clientMessageId,
      chatId: chatIdNum,
      userId: userIdNum,
      message,
      createdAt: new Date().toISOString(),
    }

    try {
      const [result] = await dbPool.execute(
        'INSERT INTO messages (chat_id, content, source, etat) VALUES (?, ?, ?, ?)',
        [chatIdNum, payload.message, userIdNum, 'non_lu']
      )

      if (result && typeof result.insertId === 'number' && result.insertId > 0) {
        payload.id = result.insertId

        try {
          await dbPool.execute(
            'UPDATE chats SET last_message_id = ? WHERE chat_id = ?',
            [payload.id, chatIdNum]
          )
        } catch (updateError) {
          console.error('Failed to update chat last_message_id:', updateError)
        }
      }
    } catch (error) {
      console.error('Failed to save message to database:', error)
    }

    socket.to(roomName).emit('new-message', payload)
  })

  socket.on('disconnect', () => {
    const { roomName, userId } = socket.data || {};
    if (!roomName) return;

    const members = rooms.get(roomName);
    if (!members) return;

    members.delete(String(userId));
    if (members.size === 0) {
      rooms.delete(roomName);
    }

    io.to(roomName).emit('room-left', {
      roomName,
      userId,
      members: Array.from(members),
    });
  });
});

const port = 3001;
server.listen(port, () => {
  console.log(`messaging-service listening on port ${port}`);
});
