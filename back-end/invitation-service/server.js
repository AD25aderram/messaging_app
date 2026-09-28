const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const pool = require('./db');
require('dotenv').config();
const app = express();

app.get('/:token', async (req, res) => {
    const token_friend = req.params.token;
    try {
        const decode = jwt.verify(token_friend, process.env.FRIEND_TOKEN_SECRET)
        const user_id = decode.u
                const id_friend = decode.f;
                console.log('decoded token:', decode);
                // Insert only if a chat between these users doesn't already exist (either direction)
                const insertQuery = `
                    INSERT INTO chats (user1_id, user2_id, last_message_id)
                    SELECT ?, ?, ? FROM DUAL
                    WHERE NOT EXISTS (
                        SELECT 1 FROM chats WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)
                    )`;
                const [result] = await pool.execute(insertQuery, [user_id, id_friend,1, user_id, id_friend, id_friend, user_id]);
                if (result && result.affectedRows && result.affectedRows > 0) {
                    console.log('inserted new chat:', result);
                } else {
                    console.log('chat already exists, skipped insert');
                }
        res.redirect(301, 'http://localhost:5173/');
    } catch(erreur) {
        console.error("contact insertion erreur", erreur);
        return res.sendStatus(500);
    }

})

app.listen(2333, ()=>{
    console.log("server runing ...")
})