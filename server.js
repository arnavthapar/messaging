require('dotenv').config({quiet:true});

const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const app = express();
app.set('trust proxy', 1);
app.use(cors({origin:'https://messaging-production-8499.up.railway.app/'}));
const PORT = 8080;
const bcrypt = require('bcrypt');
const saltRounds = 10;
const pool = require('./db');
app.use((req, res, next) => {
    if (req.path.endsWith('.html')) {
        const cleanPath = req.path.slice(0, -5);
    return res.redirect(301, cleanPath);
    }
    next();
});
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser([process.env.COOKIE_CODE]));
/*const { createClient } = require('redis');
const redis = createClient({url:process.env.REDIS_URL});
redis.connect();
const subscriber = redis.duplicate();
subscriber.connect();*/
const clients = new Map();

function notifyUser(userId, data) {
    const userClients = clients.get(userId);
    if (userClients) {
        for (const res of userClients) {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        }
    }
}
let sessions = {};
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
        }
    }
}));
const limiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 10, // 10 attempts per window
    message: { message: 'Too many attempts, try again later.' }
});

const limiterSlow = rateLimit({
    windowMs: 3 * 60 * 1000, // 3 minutes
    max: 15, // 15 attempts per window
    message: { message: 'Too many attempts, try again later.' }
});
const sendLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60, // 60 attempts per window
    message: { message: 'Too many messages sent, try again later.' }
});
//const limiterSuperSlow = rateLimit({
//    windowMs: 60000,
//    max: 60,
//    message: { message: 'Too many attempts, try again later.' }
//});
/*
users
+---------------+--------------+------+-----+-------------------+-------------------+
| Field         | Type         | Null | Key | Default           | Extra             |
+---------------+--------------+------+-----+-------------------+-------------------+
| id            | int unsigned | NO   | PRI | NULL              | auto_increment    |
| username      | letchar(50)  | NO   | UNI | NULL              |                   |
| password_hash | letchar(255) | NO   |     | NULL              |                   |
| created_at    | datetime     | YES  |     | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| time_format   | letchar(5)   | NO   |     | en-US             |                   |
| hour_format   | tinyint      | NO   |     | 0                 |                   |
+---------------+--------------+------+-----+-------------------+-------------------+

messages
+------------+-----------------+------+-----+-------------------+-------------------+
| Field      | Type            | Null | Key | Default           | Extra             |
+------------+-----------------+------+-----+-------------------+-------------------+
| id         | bigint unsigned | NO   | PRI | NULL              | auto_increment    |
| channel_id | bigint unsigned | NO   | MUL | NULL              |                   |
| user_id    | bigint unsigned | NO   | MUL | NULL              |                   |
| content    | text            | NO   |     | NULL              |                   |
| created_at | datetime        | YES  |     | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
+------------+-----------------+------+-----+-------------------+-------------------+

server_members
+-----------+--------------+------+-----+---------+-------+
| Field     | Type         | Null | Key | Default | Extra |
+-----------+--------------+------+-----+---------+-------+
| server_id | int unsigned | NO   | PRI | NULL    |       |
| user_id   | int unsigned | NO   | PRI | NULL    |       |
+-----------+--------------+------+-----+---------+-------+

servers
+------------+--------------+------+-----+-------------------+-------------------+
| Field      | Type         | Null | Key | Default           | Extra             |
+------------+--------------+------+-----+-------------------+-------------------+
| id         | int unsigned | NO   | PRI | NULL              | auto_increment    |
| owner_id   | int unsigned | NO   |     | NULL              |                   |
| created_at | datetime     | YES  |     | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
+------------+--------------+------+-----+-------------------+-------------------+

dms
+------------+-----------------+------+-----+-------------------+-------------------+
| Field      | Type            | Null | Key | Default           | Extra             |
+------------+-----------------+------+-----+-------------------+-------------------+
| id         | bigint unsigned | NO   | PRI | NULL              | auto_increment    |
| sender     | int unsigned    | YES  |     | NULL              |                   |
| reciever   | int unsigned    | YES  |     | NULL              |                   |
| created_at | datetime        | YES  |     | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| content    | text            | YES  |     | NULL              |                   |
+------------+-----------------+------+-----+-------------------+-------------------+

chat_groups
+------------+-----------------+------+-----+-------------------+-------------------+
| Field      | Type            | Null | Key | Default           | Extra             |
+------------+-----------------+------+-----+-------------------+-------------------+
| id         | bigint unsigned | NO   | PRI | NULL              | auto_increment    |
| name       | letchar(100)    | NO   |     | NULL              |                   |
| owner_id   | int unsigned    | NO   |     | NULL              |                   |
| created_at | datetime        | YES  |     | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
+------------+-----------------+------+-----+-------------------+-------------------+

group_members
+----------+-----------------+------+-----+---------+-------+
| Field    | Type            | Null | Key | Default | Extra |
+----------+-----------------+------+-----+---------+-------+
| group_id | bigint unsigned | NO   | PRI | NULL    |       |
| user_id  | int unsigned    | NO   | PRI | NULL    |       |
+----------+-----------------+------+-----+---------+-------+

group_messages
+------------+-----------------+------+-----+-------------------+-------------------+
| Field      | Type            | Null | Key | Default           | Extra             |
+------------+-----------------+------+-----+-------------------+-------------------+
| id         | bigint unsigned | NO   | PRI | NULL              | auto_increment    |
| group_id   | bigint unsigned | NO   |     | NULL              |                   |
| sender     | int unsigned    | NO   |     | NULL              |                   |
| content    | text            | NO   |     | NULL              |                   |
| created_at | datetime        | YES  |     | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
+------------+-----------------+------+-----+-------------------+-------------------+
*/
async function getId(username) {
    const [rows] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
    if (rows.length === 0) return null;
    return rows[0].id;
}
function authMiddleware(req, res, next) {
    const sessionId = req.signedCookies.user;

    if (!sessionId || !sessions[sessionId]) {
        return res.redirect('/'); // redirect to login page
    }

    const session = sessions[sessionId];

    if (Date.now() > session.expiresAt) {
        delete sessions[sessionId]; // remove expired session
        return res.redirect('/'); // redirect to login page
    }

    req.username = session.username;
    req.userId = session.userId;
    next();
}
async function checkUsername(username) {
    const [rows] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
    if (rows.length > 0) {
        return true
    }
    return false
}

// Prune expired sessions every hour
setInterval(() => {
    const now = Date.now();
    for (const id in sessions) {
        if (sessions[id].expiresAt < now) delete sessions[id];
    }
}, 60 * 60 * 1000);

app.post('/api/create-account', limiterSlow, async (req, res) => {
    const {username, password} = req.body;
    if (!username || !password) {
        return res.status(400).json({message: 'Username and password are required'});
    }
    if (username.length > 50 || password.length > 50) {
        return res.status(413).json({'message':"Your username and password must be equal to or below 50 characters each."});
    } else if (username.length < 3 || password.length < 3) {
        return res.status(413).json({'message':"Your username and password must be at least 3 characters each."});
    }
    const validUsername = /^[a-zA-Z0-9_-]+$/;
    if (!validUsername.test(username)) {
        return res.status(400).json({ message: 'Username can only contain letters, numbers, dashes, and underscores.' });
    }
    try {
        // Check if username already exists
        const [rows] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
        if (rows.length > 0) {
            return res.status(409).json({message: 'Username already exists'});
        }
        // Hash the password
        const password_hash = await bcrypt.hash(password, saltRounds);

        // Insert user
        await pool.query('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, password_hash]);

        res.json({success: true});
    } catch (err) {
        console.error(err);
        res.status(500).json({message: 'Internal server error'});
    }
});
app.post('/api/create_group', authMiddleware, async (req, res) => {
    try {
        const {name, members, message} = req.body;
        if (!name || !members) {
            return res.status(400).json({message: 'Group name and members are required'});
        } else if (message && message.length > 4000) {
            return res.status(400).json({message: 'Message cannot exceed 4000 characters.'});
        } else if (name.length > 50) {
            return res.status(413).json({message: 'Group name cannot exceed 50 characters.'});
        }
        const [rows] = await pool.query('INSERT INTO chat_groups (name, owner_id) VALUES (?, ?)', [name, req.userId]);
        const groupId = rows.insertId;
        await pool.query('INSERT IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)', [groupId, req.userId]);
        for (const member of members) {
            const memberId = await getId(member);
            if (memberId) {
                await pool.query('INSERT IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)', [groupId, memberId]);
            }
        }
        if (message && message.length > 0) {
        await pool.query(
            'INSERT INTO group_messages (group_id, sender, content) VALUES (?, ?, ?)',
            [groupId, req.userId, message]
        );
    }
        res.json({success: true});
    } catch (err) {
        console.error(err);
        res.status(500).json({message: 'Internal server error'});
    }
});

app.post('/api/delete_account', authMiddleware, async (req, res) => {
    try {
        const userId = req.userId;
        const sessionId = req.signedCookies.user;
        await pool.query('DELETE FROM users WHERE id = ?', [userId]);
        await pool.query('DELETE FROM dms WHERE sender = ? OR reciever = ?', [userId, userId]);
        await pool.query('DELETE FROM group_members WHERE user_id = ?', [userId]);
        await pool.query('DELETE FROM chat_groups WHERE owner_id = ?', [userId]);
        delete sessions[sessionId];
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
});
app.post('/api/get_senders', authMiddleware, async (req, res) => {
    try {
        const myId = req.userId;

        const [dmRows] = await pool.query(
            `SELECT DISTINCT u.username AS person, 'dm' AS type, NULL AS id FROM dms
            JOIN users u ON u.id = dms.sender
            WHERE dms.reciever = ?
            UNION
            SELECT DISTINCT u.username AS person, 'dm' AS type, NULL AS id FROM dms
            JOIN users u ON u.id = dms.reciever
            WHERE dms.sender = ?`,
            [myId, myId]
        );

        const [groupRows] = await pool.query(
            `SELECT cg.name AS person, 'group' AS type, cg.id AS id
            FROM chat_groups cg
            JOIN group_members gm ON gm.group_id = cg.id
            WHERE gm.user_id = ?`,
            [myId]
        );

        res.json({ senders: [...dmRows, ...groupRows] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
});
app.post('/api/get_username', authMiddleware, async (req, res) => {
    try {
        const sessionId = req.signedCookies.user;
        res.json({username: sessions[sessionId].username});
    } catch (err) {
        console.error(err);
        res.status(500).json({message: 'Internal server error'});
    }
});
app.post('/api/get_messages', authMiddleware, async (req, res) => {
    try {
        const myId = req.userId;

        if (req.body.group) {
            if (req.body.group && isNaN(parseInt(req.body.group))) {
                return res.status(400).json({ message: 'Invalid group.' });
            }
            // Check user is actually in the group
            const [[groupInfo], [userTimeFormat], [groupUsers], [membership]] = await Promise.all([
                pool.query('SELECT name FROM chat_groups WHERE id = ?', [req.body.group]),
                pool.query('SELECT time_format FROM users WHERE id = ?', [myId]),
                pool.query(`SELECT u.username FROM users u
                            JOIN group_members gm ON gm.user_id = u.id
                            WHERE gm.group_id = ?`, [req.body.group]),
                pool.query('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?',
                            [req.body.group, myId])
            ]);

            if (membership.length === 0) {
                return res.status(403).json({ message: 'You are not in this group.' });
            }

            const [rows] = await pool.query(
                `SELECT * FROM (
                    SELECT gm_msgs.*, u.username as sender_name FROM group_messages gm_msgs
                    JOIN users u ON u.id = gm_msgs.sender
                    WHERE gm_msgs.group_id = ?
                    ORDER BY gm_msgs.created_at DESC LIMIT ?
                ) sub ORDER BY created_at ASC`,
                [req.body.group, req.body.limit + 1 || 101]
            );
            let extra = false;
            if (rows.length > req.body.limit) {
                extra = true;
                rows.shift();
            }
            return res.json({
                groupName: groupInfo[0]?.name || null,
                extra:extra,
                groupUsers:groupUsers.map(r => r.username) || null,
                messages: rows.map(row => ({
                    id: row.id,
                    content: row.content,
                    sender: row.sender_name,
                    datetime: row.created_at.toLocaleString(userTimeFormat[0].time_format, {month: 'numeric', day: 'numeric',  year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }),
                })),
            });
        }

        // DM path
        const otherId = await getId(req.body.sender);
        if (!otherId) {
            return res.status(400).json({ message: 'User not found.' });
        }
        const [rows] = await pool.query(
            `SELECT * FROM (
                SELECT dms.*, u.username as sender_name, u.time_format FROM dms
                JOIN users u ON u.id = dms.sender
                WHERE (dms.reciever = ? AND dms.sender = ?) OR (dms.reciever = ? AND dms.sender = ?)
                ORDER BY dms.created_at DESC LIMIT ?
            ) sub ORDER BY created_at ASC`,
            [myId, otherId, otherId, myId, req.body.limit + 1]
        );
        let extra = false;
        if (rows.length > req.body.limit) {
            let extra = true;
            rows.shift();
        }
        const [userTimeFormat] = await pool.query('SELECT time_format, hour_format FROM users WHERE id = ?', [myId]);
        res.json({
            extra:extra,
            messages: rows.map(row => ({
            id: row.id,
            content: row.content,
            sender: row.sender_name,
            datetime: row.created_at.toLocaleString(userTimeFormat[0].time_format, {month: 'numeric', day: 'numeric',  year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: !userTimeFormat[0].hour_format })
        }))});
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.post('/api/send_message', sendLimiter, authMiddleware, async (req, res) => {
    try {
        const { content, recipient, group } = req.body;
        if (!content) {
            return res.status(400).json({ message: 'Content is required.' });
        } else if (content.length > 4000) {
            return res.status(400).json({ message: 'Message cannot exceed 4000 characters.' });
        } else if (content.length === 0) {
            return res.status(400).json({ message: 'Message cannot be empty.' });
        }
        console.log(req.userId);
        console.log(group + "G")
        if (!Number.isInteger(Number(req.userId))) {
            return res.status(400).json({ message: 'Invalid ID.' });
        }
        if (!Number.isInteger(Number(group))) {
            return res.status(400).json({ message: 'Invalid ID.' });
        }
        if (group) {
            const [membership] = await pool.query(
                'SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?',
                [group, req.userId]
            );
            if (membership.length === 0) {
                return res.status(403).json({ message: 'You are not in this group.' });
            }
            await pool.query(
                'INSERT INTO group_messages (group_id, sender, content) VALUES (?, ?, ?)',
                [group, req.userId, content]
            );
            const [groupMembers] = await pool.query('SELECT user_id FROM group_members WHERE group_id = ?', [group]);
            for (const member of groupMembers) {
                //await redis.publish(`messages:${member.user_id}`, JSON.stringify({ content, sender: req.username }));
                notifyUser(member.user_id, { content, sender: req.username });
            }

            return res.json({ success: true });
        }

        // DM path
        if (!recipient) {
            return res.status(400).json({ message: 'Recipient is required.' });
        }
        if (req.username === recipient) {
            return res.status(400).json({ message: 'You cannot send a message to yourself.' });
        }
        const recipientId = await getId(recipient);
        if (!recipientId) {
            return res.status(400).json({ message: 'Recipient does not exist.' });
        }
        await pool.query(
            'INSERT INTO dms (sender, reciever, content) VALUES (?, ?, ?)',
            [req.userId, recipientId, content]
        );
        res.json({ success: true });
        notifyUser(recipientId, { content, sender: req.username });
        notifyUser(req.userId, { content, sender: req.username });
        //await redis.publish(`messages:${recipientId}`, JSON.stringify({
        //    content,
        //    sender: req.username,
        //}));
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.post('/api/delete_message', authMiddleware, async (req, res) => {
    try {
        const id = req.body.id;
        const userId = req.userId;
        if (!Number.isInteger(Number(id))) {
            return res.status(400).json({ message: 'Invalid ID.' });
        }
        if (req.body.dm) {
            const [dmRows] = await pool.query('SELECT sender, reciever FROM dms WHERE id = ?', [id]);
            if (dmRows.length > 0) {
                if (dmRows[0].sender != userId) {
                    return res.status(403).json({ message: 'You cannot delete this message.' });
                }
                await pool.query('DELETE FROM dms WHERE id = ? AND sender = ?', [id, userId]);
                notifyUser(dmRows[0].reciever, { deleted: true });
                //await redis.publish(`messages:${dmRows[0].reciever}`, JSON.stringify({ deleted: true }));
                return res.json({ success: true });
            }

        } else {
            const [groupRows] = await pool.query('SELECT sender, group_id FROM group_messages WHERE id = ?', [id]);
            if (groupRows.length > 0) {
                if (groupRows[0].sender != userId) {
                    return res.status(403).json({ message: 'You cannot delete this message.' });
                }
                await pool.query('DELETE FROM group_messages WHERE id = ? AND sender = ?', [id, userId]);
                const [groupMembers] = await pool.query('SELECT user_id FROM group_members WHERE group_id = ?', [groupRows[0].group_id]);
                for (const member of groupMembers) {
                    notifyUser(member.user_id, { deleted: true });
                    //await redis.publish(`messages:${member.user_id}`, JSON.stringify({ deleted: true }));
                }
                return res.json({ success: true });
            }
        }
        return res.status(404).json({ message: 'Message not found.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
});
app.post('/api/change_username', limiterSlow, authMiddleware, async (req, res) => {
    try {
        if (!req.body.username) {
            return res.status(400).json({message: 'Username is required.'});
        } else if (req.body.username.length > 50) {
            return res.status(400).json({message: 'Username cannot exceed 50 characters.'});
        }
        if (req.username === req.body.username) {
            return res.status(400).json({message: 'You cannot change your username to the same username.'});
        } else if (await checkUsername(req.body.username)) {
            return res.status(400).json({message: 'Username is taken.'});
        }
        await pool.query('UPDATE users SET username = ? WHERE id = ?', [req.body.username, req.userId]);
        sessions[req.signedCookies.user].username = req.body.username;
        res.json({success: true});
    } catch (err) {
        console.error(err);
        res.status(500).json({message: 'Internal server error'});
    }
});
app.post('/api/add_group_member', limiter, authMiddleware, async (req, res) => {
    const {username, group} = req.body;
    if (!username || !group){
        return res.status(400).json({message: 'Username and group are required.'});
    }
    const [membership] = await pool.query('SELECT owner_id FROM chat_groups WHERE id = ?', [group]);
    if (membership[0].owner_id != sessions[req.signedCookies.user].userId) {
        return res.status(403).json({ message: 'You are not the owner in this group.' });
    }
    userId = await getId(username);
    const [membership2] = await pool.query(
    'SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?',
        [group, userId]
    );
    if (membership2.length !== 0) {
        return res.status(400).json({ message: 'That user is already in this group.' });
    }
    await pool.query('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)', [group, userId]);
    res.json({success:true})
});
app.post('/api/remove_group_member', limiter, authMiddleware, async (req, res) => {
    const {username, group} = req.body;
    if (!username || !group){
        return res.status(400).json({message: 'Username and group are required.'});
    }
    const [membership] = await pool.query('SELECT owner_id FROM chat_groups WHERE id = ?', [group]);
    if (membership[0].owner_id != sessions[req.signedCookies.user].userId) {
        return res.status(403).json({ message: 'You are not the owner in this group.' });
    }
    userId = await getId(username);
    const [membership2] = await pool.query(
    'SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?',
        [group, userId]
    );
    if (membership2.length === 0) {
        return res.status(400).json({ message: 'That user is not in this group.' });
    }
    await pool.query(
        'DELETE FROM group_members WHERE user_id = ? AND group_id = ?', [userId, group]
    )
    res.json({success:true})
});
app.post('/api/delete_group', limiter, authMiddleware, async (req, res) => {
    const {group} = req.body;
    if (!group){
        return res.status(400).json({message: 'Group id is required.'});
    }
    const [membership] = await pool.query('SELECT owner_id FROM chat_groups WHERE id = ?', [group]);
    if (membership[0].owner_id != sessions[req.signedCookies.user].userId) {
        return res.status(403).json({ message: 'You are not the owner in this group.' });
    }
    await pool.query(
        'DELETE FROM group_members WHERE group_id = ?', [group]
    )
    await pool.query(
        'DELETE FROM chat_groups WHERE id = ?', [group]
    )
    await pool.query(
        'DELETE FROM group_messages WHERE group_id = ?', [group]
    )
    res.json({success:true})
});
app.post('/api/rename_group', limiter, authMiddleware, async (req, res) => {
    const {group, name} = req.body;
    if (!group || !name){
        return res.status(400).json({message: 'Group ID and new name is required.'});
    }
    if (name.length > 50) {
        return res.status(413).json({message: 'Name must be less than 50 characters.'})
    }
    if (name.length < 3) {
        return res.status(400).json({message: 'Name must be more than 3 characters.'})
    }
    const [membership] = await pool.query('SELECT 1 FROM group_members WHERE user_id = ? AND group_id = ?', [sessions[req.signedCookies.user].userId, group]);
    if (membership.length == 0) {
        return res.status(403).json({ message: 'You are not in this group.' });
    }
    await pool.query('UPDATE chat_groups SET name=?', [name])
    res.json({success:true})
});
app.post('/api/login', limiter, async (req, res) => {
    const {username, password} = req.body;
    if (!username || !password) {
        return res.status(400).json({message: 'Username and password are required.'});
    }
    try {
        const [rows] = await pool.query('SELECT id, password_hash FROM users WHERE username = ?', [username]);
        if (rows.length === 0) {
            return res.status(401).json({message: 'Invalid username'});
        }

        const valid = await bcrypt.compare(password, rows[0].password_hash);
        if (!valid) {
            return res.status(401).json({message: 'Invalid credentials'});
        }

        res.clearCookie('user');
        const sessionId = crypto.randomBytes(32).toString("hex");
        res.cookie('user', sessionId, {
            httpOnly: true,
            signed: true,
            secure: true,
            sameSite: 'lax',
            maxAge: 86400000,
        });
        const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours
        sessions[sessionId] = {
            username,
            userId: rows[0].id,
            expiresAt: Date.now() + SESSION_DURATION
        };
        res.json({success: true});
    } catch (err) {
        console.error(err);
        res.status(500).json({message: 'Internal server error'});
    }
});
app.post('/api/change_time_format', authMiddleware, async (req, res) => {
    try {
        const id = req.userId;
        const [rows] = await pool.query('SELECT time_format FROM users WHERE id = ?', [id]);
        if (rows[0].time_format == "en-US") {
            await pool.query('UPDATE users SET time_format="en-GB" WHERE id = ?;', [id])
        } else {
            await pool.query('UPDATE users SET time_format="en-US" WHERE id = ?;', [id])
        }
        res.json({success:true});
    } catch (err) {
        console.error(err);
        res.status(500).json({message: 'Internal server error'});
    }
})
app.post('/api/change_hour_format', authMiddleware, async (req, res) => {
    try {
        const id = req.userId;
        const [rows] = await pool.query('SELECT hour_format FROM users WHERE id = ?', [id]);
        await pool.query('UPDATE users SET hour_format = ? WHERE id = ?;', [1-rows[0].hour_format, id]);
        res.json({success:true});
    } catch (err) {
        console.error(err);
        res.status(500).json({message: 'Internal server error'});
    }
});
app.get('/api/stream', authMiddleware, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const userId = req.userId;
    if (!clients.has(userId)) clients.set(userId, new Set());
    clients.get(userId).add(res);

    const keepalive = setInterval(() => res.write(': keepalive\n\n'), 30000);

    req.on('close', () => {
        clearInterval(keepalive);
        const userClients = clients.get(userId);
        if (userClients) {
            userClients.delete(res);
            if (userClients.size === 0) clients.delete(userId);
        }
    });
});
app.post('/api/logout', authMiddleware, async (req, res) => {
    const sessionId = req.signedCookies.user;
    delete sessions[sessionId];
    res.redirect('/'); // redirect to login page
});

app.get('', (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'private',  'index.html'));
});

app.get('/home', authMiddleware, (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'private', 'home.html'));
});
app.get('/settings', authMiddleware, (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'private', 'settings.html'));
});
app.get('/group_settings', authMiddleware, (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'private', 'group_settings.html'));
});

app.get('/group', authMiddleware, (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'private', 'group.html'));
});

app.use((_req, res, _next) => {
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});