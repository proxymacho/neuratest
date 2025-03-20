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

// Настройка Nodemailer
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'nestneura@gmail.com',
        pass: 'hyiq blmd pkfx gqxe'
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

// ... (остальные маршруты, такие как /register, /login и т.д., оставь как есть)

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));